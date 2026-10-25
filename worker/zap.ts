import { randomBytes } from "node:crypto";
import { copyFile, lstat, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import { ZAP_LABEL, bindMount } from "./docker";
import { run } from "./exec";
import { WAIT_SCRIPT, buildPlan, type ZapMode } from "./zapPlan";

const MAX_REPORT_BYTES = 20 * 1024 * 1024;
const MAX_SPEC_BYTES = 1024 * 1024;

function validateProfile() {
  const p = config.zapProfile;
  if (!Number.isInteger(p.port) || p.port < 1 || p.port > 65535) throw new Error("ZAP_TARGET_PORT is invalid");
  if (!/^\/[A-Za-z0-9._~\/-]{0,100}$/.test(p.healthPath)) throw new Error("ZAP_HEALTH_PATH is invalid");
  if (path.isAbsolute(p.openapiFile) || p.openapiFile.split(/[\\/]/).includes("..")) {
    throw new Error("ZAP_OPENAPI_FILE must be a relative path inside the repository");
  }
  return p;
}

// The spec comes from the scanned repository, so treat it as untrusted: a regular file, small, inside the clone.
async function copySpec(repoDir: string, destDir: string, rel: string): Promise<void> {
  const src = path.resolve(repoDir, rel);
  if (!src.startsWith(path.resolve(repoDir) + path.sep)) throw new Error("OpenAPI path escapes the repository");
  const info = await lstat(src).catch(() => null); // lstat does not follow symlinks
  if (!info || !info.isFile()) throw new Error(`OpenAPI file "${rel}" is missing or is not a regular file`);
  if (info.size > MAX_SPEC_BYTES) throw new Error("OpenAPI file is too large");
  await copyFile(src, path.join(destDir, "openapi.yaml"));
}

const tail = (s: string, n = 600) => s.slice(-n);

export async function runZapScan(args: {
  repoDir: string;
  outDir: string;
  label: "initial" | "verification";
  mode: ZapMode;
}): Promise<string> {
  if (!config.zapImage) throw new Error("ZAP_IMAGE is not set");
  const profile = validateProfile();

  const id = randomBytes(4).toString("hex");
  const imageTag = `fixitry-zap-target:${id}`;
  const targetName = `fixitry-zap-target-${id}`;
  const waitName = `fixitry-zap-wait-${id}`;
  const zapName = `fixitry-zap-${id}`;

  const zapDir = path.join(args.outDir, `zap-${args.label}`);
  await mkdir(zapDir, { recursive: true });
  await copySpec(args.repoDir, zapDir, profile.openapiFile);
  await writeFile(path.join(zapDir, "plan.yaml"), buildPlan({ mode: args.mode, port: profile.port, workDir: "/zap/wrk" }), "utf8");
  await writeFile(path.join(zapDir, "wait.py"), WAIT_SCRIPT, "utf8");

  const baseUrl = `http://127.0.0.1:${profile.port}`;
  try {
    // 1. Build the repository's own Dockerfile (this is the only step with network access).
    const build = await run(
      "docker",
      ["build", "--quiet", "--label", ZAP_LABEL, "--tag", imageTag, args.repoDir],
      { timeoutMs: 15 * 60_000, maxBytes: 1_000_000 },
    );
    if (build.exitCode !== 0) {
      throw new Error(`Building the target image failed${build.timedOut ? " (timed out)" : ""}: ${tail(build.stderr)}`);
    }

    // 2. Start the target with no network at all, limited resources, and no extra privileges.
    const start = await run(
      "docker",
      [
        "run", "-d", "--name", targetName, "--label", ZAP_LABEL,
        "--network", "none", "--memory", "512m", "--cpus", "1", "--pids-limit", "256",
        "--cap-drop", "ALL", "--security-opt", "no-new-privileges", imageTag,
      ],
      { timeoutMs: 60_000 },
    );
    if (start.exitCode !== 0) throw new Error(`Starting the target failed: ${tail(start.stderr)}`);

    // 3. Wait until the app answers. ZAP joins the target's network namespace, so 127.0.0.1 is the app.
    const wait = await run(
      "docker",
      [
        "run", "--rm", "--name", waitName, "--label", ZAP_LABEL,
        "--network", `container:${targetName}`, "--cap-drop", "ALL",
        ...bindMount(zapDir, "/zap/wrk", true),
        config.zapImage, "python3", "/zap/wrk/wait.py", `${baseUrl}${profile.healthPath}`, "60",
      ],
      { timeoutMs: 120_000 },
    );
    if (wait.exitCode !== 0) {
      const logs = await run("docker", ["logs", "--tail", "20", targetName], { timeoutMs: 15_000 });
      throw new Error(`The target app did not start listening on ${baseUrl}. Container log: ${tail(logs.stdout + logs.stderr)}`);
    }

    // 4. Scan.
    const scan = await run(
      "docker",
      [
        "run", "--rm", "--name", zapName, "--label", ZAP_LABEL,
        "--network", `container:${targetName}`,
        "--memory", "2g", "--cpus", "2", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
        ...bindMount(zapDir, "/zap/wrk", false),
        config.zapImage, "zap.sh", "-cmd", "-silent", "-autorun", "/zap/wrk/plan.yaml",
      ],
      { timeoutMs: (args.mode === "active" ? 25 : 10) * 60_000, maxBytes: 5_000_000 },
    );
    if (scan.exitCode !== 0) {
      throw new Error(`ZAP failed${scan.timedOut ? " (timed out)" : ""}: ${tail(scan.stdout + scan.stderr)}`);
    }

    const report = path.join(zapDir, "zap-report.json");
    const info = await stat(report).catch(() => null);
    if (!info) throw new Error("ZAP finished but wrote no report");
    if (info.size > MAX_REPORT_BYTES) throw new Error(`ZAP report too large (${info.size} bytes)`);
    return report;
  } finally {
    // Always remove what we started, whether the scan worked or not.
    await run("docker", ["rm", "-f", targetName, waitName, zapName], { timeoutMs: 60_000 });
    await run("docker", ["rmi", "-f", imageTag], { timeoutMs: 120_000 });
  }
}