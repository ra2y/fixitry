import type { Doc } from "../convex/_generated/dataModel";
import { isAllowed } from "../convex/lib/repoUrl";
import { api } from "../convex/_generated/api";
import { config } from "./config";
import { convex } from "./convexClient";

import { createJobDir, cloneRepo, headSha } from "./repository";
import { removeJobDir } from "./cleanup";
import { logEvent } from "./convexClient";

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { runTrivy } from "./trivy";

import { readFile } from "node:fs/promises";
import { parseTrivy } from "./parseTrivy";
import { saveFindings } from "./convexClient";

import { allowedFilesFor, runRepair } from "./droid";
import { changedFiles, revertAll, stagedPatch } from "./repository";

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
    await setStatus(job._id, findings.length > 0 ? "awaiting_approval" : "completed");

    const sha = await headSha(repoDir);
    await convex.mutation(api.jobs.setCommit, { secret: config.workerSecret, jobId: job._id, commitSha: sha });
  } finally {
    await removeJobDir(jobDir);
    await logEvent(job._id, "worker", "Temporary directory removed");
  }
}

async function processRepair(job: Doc<"jobs">) {
  if (!job.selectedFindingId) throw new Error("No finding was approved");
  const finding = await convex.query(api.jobs.getFinding, { secret: config.workerSecret, findingId: job.selectedFindingId });
  if (!finding) throw new Error("Approved finding not found");

  const attemptId = await convex.mutation(api.repairAttempts.start, {
    secret: config.workerSecret, jobId: job._id, findingId: finding._id,
  });
  const finish = (fields: Omit<Parameters<typeof convex.mutation<typeof api.repairAttempts.finish>>[1], "secret" | "attemptId">) =>
    convex.mutation(api.repairAttempts.finish, { secret: config.workerSecret, attemptId, ...fields });

  const jobDir = await createJobDir();
  try {
    const repoDir = await cloneRepo(job.repoUrl, jobDir);
    const sha = await headSha(repoDir);
    if (job.commitSha && sha !== job.commitSha) {
      throw new Error("Repository changed since the scan. Please run a new scan.");
    }

    await logEvent(job._id, "droid", `Starting repair of ${finding.ruleId} in ${finding.target}`);
    const out = await runRepair({ repoDir, finding, log: (m, l) => logEvent(job._id, "droid", m, l) });

    const allowed = allowedFilesFor(finding);
    const changed = await changedFiles(repoDir);
    const outside = changed.filter((f) => !allowed.includes(f));
    if (outside.length > 0) {
      await revertAll(repoDir);
      throw new Error(`Droid modified files outside the approved list: ${outside.join(", ")}`);
    }
    if (!out.success || changed.length === 0) {
      await finish({ status: "failed", summary: out.summary, error: out.error ?? "Droid made no changes" });
      await setStatus(job._id, "completed");
      return;
    }

    const { patch, truncated } = await stagedPatch(repoDir);
    await logEvent(job._id, "worker", `Changed files: ${changed.join(", ")}`);

    // Phase 13 replaces this stub with tests and a second scan.
    await finish({ status: "failed", summary: out.summary, filesChanged: changed, patch, patchTruncated: truncated,
                   error: "Tests and verification not implemented yet (Phase 13)" });
    await setStatus(job._id, "testing");
    await setStatus(job._id, "verifying");
    await setStatus(job._id, "completed");
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
