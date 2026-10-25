import type { Doc } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";
import { config } from "./config";
import { convex, logEvent, saveFindings } from "./convexClient";

import { createJobDir, cloneRepo, headSha, changedFiles, revertAll, stagedPatch } from "./repository";
import { removeJobDir } from "./cleanup";
import { allowedFilesFor, runRepair } from "./droid";
import { runPythonTests, type TestResult } from "./tests";
import { compareFindings } from "../shared/compare";

import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { runTrivy } from "./trivy";
import { parseTrivy } from "./parseTrivy";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;
process.on("SIGINT", () => {
  console.log("Stopping after the current job...");
  stopping = true;
});

type Claimed = { kind: "scan" | "repair"; job: Doc<"jobs"> };

async function setStatus(
  jobId: Doc<"jobs">["_id"],
  status: Doc<"jobs">["status"],
  error?: string,
) {
  await convex.mutation(api.jobs.setStatus, {
    secret: config.workerSecret,
    jobId,
    status,
    error,
  });
}

async function processRepair(job: Doc<"jobs">) {
  if (!job.selectedFindingId) throw new Error("No finding was approved");
  if (!job.commitSha) throw new Error("Scan commit was not recorded; run a new scan");
  const finding = await convex.query(api.jobs.getFinding, {
    secret: config.workerSecret, findingId: job.selectedFindingId,
  });
  if (!finding || finding.jobId !== job._id || finding.scanRound !== "initial") {
    throw new Error("Approved finding not found for this job");
  }

  const attemptId = await convex.mutation(api.repairAttempts.start, {
    secret: config.workerSecret, jobId: job._id, findingId: finding._id,
  });
  let attemptFinished = false;
  let jobDir: string | undefined;
  let summary = "";
  let patchInfo: { patch: string; truncated: boolean } | undefined;
  let tests: TestResult | undefined;
  try {
    jobDir = await createJobDir();
    const repoDir = await cloneRepo(job.repoUrl, jobDir);
    if (await headSha(repoDir) !== job.commitSha) {
      throw new Error("Repository changed since the scan. Please run a new scan.");
    }

    await logEvent(job._id, "droid", `Starting repair of ${finding.ruleId} in ${finding.target}`);
    const output = await runRepair({
      repoDir, finding, log: (message, level) => logEvent(job._id, "droid", message, level),
    });
    summary = output.summary;
    const allowed = allowedFilesFor(finding);
    const changed = await changedFiles(repoDir);
    const outside = changed.filter((file) => !allowed.includes(file));
    if (outside.length > 0) {
      await revertAll(repoDir);
      throw new Error(`Droid modified files outside the approved list: ${outside.join(", ")}`);
    }

    if (!output.success || changed.length === 0) {
      await convex.mutation(api.repairAttempts.finish, {
        secret: config.workerSecret, attemptId, status: "failed",
        summary, error: output.error ?? "Droid made no changes",
        filesChanged: changed,
      });
      attemptFinished = true;
      await logEvent(job._id, "droid", output.error ?? "Droid made no changes", "warn");
      throw new Error(output.error ?? "Droid made no changes");
    } else {
      patchInfo = await stagedPatch(repoDir);
      await logEvent(job._id, "worker", `Changed files: ${changed.join(", ")}`);
      await setStatus(job._id, "testing");
      await logEvent(job._id, "tests", "Creating virtual environment and running tests");
      tests = await runPythonTests(repoDir, jobDir);
      await logEvent(job._id, "tests", tests.passed ? "Tests passed" : "Tests FAILED", tests.passed ? "info" : "error");
      await setStatus(job._id, "verifying");
      await logEvent(job._id, "trivy", "Running verification scan");
      const outDir = path.join(jobDir, "out");
      await mkdir(outDir, { recursive: true });
      const file = await runTrivy(repoDir, outDir, "verification");
      const after = parseTrivy(JSON.parse(await readFile(file, "utf8")));
      await saveFindings(job._id, "verification", after);
      const before = await convex.query(api.findings.listForWorker, {
        secret: config.workerSecret, jobId: job._id, scanRound: "initial",
      });
      const { resolved, remaining, introduced } = compareFindings(before, after);
      const selectedResolved = resolved.some((entry) => entry.fingerprint === finding.fingerprint);
      await logEvent(job._id, "trivy", `Verification: ${resolved.length} resolved, ${remaining.length} remaining, ${introduced.length} new`);
      await convex.mutation(api.repairAttempts.finish, {
        secret: config.workerSecret, attemptId,
        status: tests.passed && selectedResolved ? "succeeded" : "failed",
        summary, filesChanged: changed, patch: patchInfo.patch, patchTruncated: patchInfo.truncated,
        testsPassed: tests.passed, testOutput: tests.output,
        resolvedCount: resolved.length, remainingCount: remaining.length, newCount: introduced.length,
        ...(!tests.passed ? { error: "Tests failed" } :
          !selectedResolved ? { error: "The selected finding is still present after the repair" } : {}),
      });
      attemptFinished = true;
    }
  } catch (error) {
    if (!attemptFinished) {
      const message = error instanceof Error ? error.message : String(error);
      await convex.mutation(api.repairAttempts.finish, {
        secret: config.workerSecret, attemptId, status: "failed", error: message,
        summary, ...(patchInfo ? { patch: patchInfo.patch, patchTruncated: patchInfo.truncated } : {}),
        ...(tests ? { testsPassed: tests.passed, testOutput: tests.output } : {}),
      });
    }
    throw error;
  } finally {
    if (jobDir) {
      await removeJobDir(jobDir);
      await logEvent(job._id, "worker", "Temporary directory removed");
    }
  }
  await setStatus(job._id, "completed");
}

async function processScan(job: Doc<"jobs">) {
  const jobDir = await createJobDir();
  const outDir = path.join(jobDir, "out");

  try {
    await mkdir(outDir);

    await logEvent(job._id, "worker", `Cloning ${job.repoUrl}`);

    const repoDir = await cloneRepo(job.repoUrl, jobDir);

    await logEvent(
      job._id,
      "worker",
      `Cloned at commit ${(await headSha(repoDir)).slice(0, 8)}`,
    );

    await setStatus(job._id, "scanning");

    const file = await runTrivy(repoDir, outDir, "initial");
    const size = (await stat(file)).size;

    await logEvent(
      job._id,
      "trivy",
      `Scan finished, JSON is ${size} bytes`,
    );

    const findings = parseTrivy(JSON.parse(await readFile(file, "utf8")));
    await saveFindings(job._id, "initial", findings);
    await logEvent(job._id, "trivy", `Parsed ${findings.length} findings`);
    const sha = await headSha(repoDir);
    await convex.mutation(api.jobs.setCommit, { secret: config.workerSecret, jobId: job._id, commitSha: sha });
    await setStatus(job._id, findings.length > 0 ? "awaiting_approval" : "completed");
  } finally {
    await removeJobDir(jobDir);
    await logEvent(job._id, "worker", "Temporary directory removed");
  }
}

async function processJob({ kind, job }: Claimed) {
  if (kind === "scan") return processScan(job);
  if (kind === "repair") return processRepair(job);
  throw new Error("Repair not implemented yet");
}

async function main() {
  console.log(`[${config.workerId}] polling every ${config.pollIntervalMs} ms`);
  while (!stopping) {
    try {
      const claimed = await convex.mutation(api.jobs.claimNext, {
        secret: config.workerSecret,
        workerId: config.workerId,
      });
      if (!claimed) {
        await sleep(config.pollIntervalMs);
        continue;
      }
      try {
        await processJob(claimed);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Job ${claimed.job._id} failed:`, message);
        await setStatus(claimed.job._id, "failed", message);
      }
    } catch (err) {
      console.error("Polling error (will retry):", err instanceof Error ? err.message : err);
      await sleep(config.pollIntervalMs);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
