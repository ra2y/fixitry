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
  await logEvent(job._id, "worker", `Repair job claimed for finding ${job.selectedFindingId}`);
  throw new Error("Repair not implemented yet");
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
