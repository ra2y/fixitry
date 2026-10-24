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
  allowedRepositories: [required("DEMO_REPOSITORY_URL")],
  workerId: `worker-${process.pid}`,
  pollIntervalMs: 3000,
};
