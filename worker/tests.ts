import path from "node:path";
import { childEnv, run } from "./exec";

export type TestResult = { passed: boolean; output: string };
const isWin = process.platform === "win32";

export async function runPythonTests(
  repoDir: string,
  jobDir: string,
): Promise<TestResult> {
  const venvDir = path.join(jobDir, "venv");
  const py = path.join(
    venvDir,
    isWin ? "Scripts" : "bin",
    isWin ? "python.exe" : "python",
  );
  const systemPython =
    process.env.FIXITRY_PYTHON ?? (isWin ? "python" : "python3");
  const env = childEnv({
    PYTHONDONTWRITEBYTECODE: "1",
    PIP_DISABLE_PIP_VERSION_CHECK: "1",
  });

  const steps = [
    {
      label: `create venv with ${systemPython}`,
      cmd: systemPython,
      args: ["-m", "venv", venvDir],
      timeoutMs: 120_000,
    },
    {
      label: "install dependencies",
      cmd: py,
      args: ["-m", "pip", "install", "-r", "requirements.txt"],
      timeoutMs: 300_000,
    },
    {
      label: "run tests",
      cmd: py,
      args: ["-m", "pytest", "-q", "-p", "no:cacheprovider"],
      timeoutMs: 180_000,
    },
  ];

  let log = "";
  for (const s of steps) {
    const r = await run(s.cmd, s.args, {
      cwd: repoDir,
      timeoutMs: s.timeoutMs,
      maxBytes: 2_000_000,
      env,
    });
    log += `$ ${s.label} (exit ${r.exitCode}${r.timedOut ? ", timed out" : ""})\n${(r.stdout + r.stderr).slice(-1500)}\n`;
    if (r.exitCode !== 0) return { passed: false, output: log.slice(-6000) };
  }
  return { passed: true, output: log.slice(-6000) };
}
