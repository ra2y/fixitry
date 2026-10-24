import "dotenv/config";

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
  workerId: `worker-${process.pid}`,
  pollIntervalMs: 3000,
};
