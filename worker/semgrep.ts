import { randomBytes } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import { childEnv, run } from "./exec";

const MAX_JSON_BYTES = 20 * 1024 * 1024;
const SHARED_ARGS = [
  "scan",
  "--json",
  "--metrics=off",
  "--disable-version-check",
  "--quiet",
  "--no-git-ignore",
];

function mount(source: string, target: string, readonly: boolean): string[] {
  if (source.includes(","))
    throw new Error(`Cannot mount a path containing a comma: ${source}`);
  return [
    "--mount",
    `type=bind,source=${source},target=${target}${readonly ? ",readonly" : ""}`,
  ];
}

export async function runSemgrep(
  repoDir: string,
  outDir: string,
  label: "initial" | "verification",
): Promise<string> {
  const outFile = path.join(outDir, `semgrep-${label}.json`);
  const timeoutMs = 5 * 60_000;
  let res;

  if (config.semgrepMode === "local") {
    res = await run(
      "semgrep",
      [...SHARED_ARGS, "--config", config.rulesDir, "--output", outFile, "."],
      {
        cwd: repoDir,
        timeoutMs,
        maxBytes: 1_000_000,
        env: childEnv({ SEMGREP_SEND_METRICS: "off" }),
      },
    );
  } else {
    if (!config.semgrepImage) throw new Error("SEMGREP_IMAGE is not set");
    const name = `fixitry-semgrep-${randomBytes(4).toString("hex")}`;
    res = await run(
      "docker",
      [
        "run",
        "--rm",
        "--name",
        name,
        "--network",
        "none",
        "--memory",
        "2g",
        "--cpus",
        "2",
        "-w",
        "/src",
        ...mount(repoDir, "/src", true),
        ...mount(config.rulesDir, "/rules", true),
        ...mount(outDir, "/out", false),
        config.semgrepImage,
        "semgrep",
        ...SHARED_ARGS,
        "--config",
        "/rules",
        "--output",
        `/out/semgrep-${label}.json`,
        ".",
      ],
      { timeoutMs, maxBytes: 1_000_000 },
    );
    if (res.timedOut)
      await run("docker", ["rm", "-f", name], { timeoutMs: 30_000 });
  }

  if (res.exitCode !== 0)
    throw new Error(
      `Semgrep failed${res.timedOut ? " (timed out)" : ""}: ${res.stderr.slice(0, 500)}`,
    );
  const info = await stat(outFile).catch(() => null);
  if (!info) throw new Error("Semgrep produced no output file");
  if (info.size > MAX_JSON_BYTES)
    throw new Error(`Semgrep output too large (${info.size} bytes)`);
  return outFile;
}
