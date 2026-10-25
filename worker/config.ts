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
  factoryApiKey: required("FACTORY_API_KEY"),
  allowedRepositories: [required("DEMO_REPOSITORY_URL")],
  githubToken: process.env.GITHUB_TOKEN,
  workerId: `worker-${process.pid}`,
  pollIntervalMs: 3000,
  workRoot: path.join(os.tmpdir(), "fixitry"),
  keepTmp: process.env.FIXITRY_KEEP_TMP === "1", // debugging only
  semgrepMode: (process.env.SEMGREP_MODE ?? "docker") as "docker" | "local",
  semgrepImage: process.env.SEMGREP_IMAGE ?? "",
  rulesDir: path.resolve("semgrep-rules"),
  zapImage: process.env.ZAP_IMAGE ?? "",
  zapProfile: {
    port: Number(process.env.ZAP_TARGET_PORT ?? "5000"),
    healthPath: process.env.ZAP_HEALTH_PATH ?? "/health",
    openapiFile: process.env.ZAP_OPENAPI_FILE ?? "openapi.yaml",
  },
};

// Secrets now live only in `config`. Child processes inherit process.env, so remove them.
delete process.env.WORKER_SECRET;
delete process.env.FACTORY_API_KEY;
delete process.env.GITHUB_TOKEN;
