import "dotenv/config";
import os from "node:os";
import path from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  convexUrl: required("CONVEX_URL"),
  workerSecret: required("WORKER_SECRET"),
  allowedRepositories: [required("DEMO_REPOSITORY_URL")],
  workerId: `worker-${process.pid}`,
  pollIntervalMs: 3000,
  workRoot: path.join(os.tmpdir(), "fixitry"),
  keepTmp: process.env.FIXITRY_KEEP_TMP === "1", // debugging only
};
