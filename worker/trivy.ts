import { stat } from "node:fs/promises";
import path from "node:path";
import { run } from "./exec";

const MAX_JSON_BYTES = 20 * 1024 * 1024;

async function exists(p: string) {
  try { await stat(p); return true; } catch { return false; }
}

export async function runTrivy(repoDir: string, outDir: string, label: "initial" | "verification"): Promise<string> {
  const outputFile = path.join(outDir, `trivy-${label}.json`);
  const args = [
    "fs", "--scanners", "vuln,secret,misconfig",
    "--format", "json", "--output", outputFile,
    "--quiet", "--timeout", "5m",
  ];
  if (await exists(path.join(repoDir, "trivy-secret.yaml"))) {
    args.push("--secret-config", "trivy-secret.yaml");
  }
  args.push(".");

  const res = await run("trivy", args, { cwd: repoDir, timeoutMs: 6 * 60_000, maxBytes: 1_000_000 });
  if (res.exitCode !== 0) {
    throw new Error(`Trivy failed${res.timedOut ? " (timed out)" : ""}: ${res.stderr.slice(0, 500)}`);
  }
  const info = await stat(outputFile);
  if (info.size > MAX_JSON_BYTES) throw new Error(`Trivy output too large (${info.size} bytes)`);
  return outputFile;
}