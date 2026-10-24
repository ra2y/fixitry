import { ConvexHttpClient } from "convex/browser";
import { config } from "./config";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

import type { NormalizedFinding } from "../shared/types";

export async function logEvent(
  jobId: Id<"jobs">,
  source: "worker" | "trivy" | "droid" | "tests",
  message: string,
  level: "info" | "warn" | "error" = "info",
) {
  console.log(`[${source}] ${message}`);
  await convex.mutation(api.events.add, { secret: config.workerSecret, jobId, source, level, message });
}

export const convex = new ConvexHttpClient(config.convexUrl);

export async function saveFindings(jobId: Id<"jobs">, round: "initial" | "verification", findings: NormalizedFinding[]) {
  for (let i = 0; i < findings.length; i += 50) {
    await convex.mutation(api.findings.addBatch, {
      secret: config.workerSecret, jobId, scanRound: round, findings: findings.slice(i, i + 50),
    });
  }
}