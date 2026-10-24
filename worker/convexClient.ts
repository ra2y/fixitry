import { ConvexHttpClient } from "convex/browser";
import { config } from "./config";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

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
