import path from "node:path";
import { childEnv, run } from "./exec";

export type TestResult = { passed: boolean; output: string };

async function choosePython(env: NodeJS.ProcessEnv): Promise<string> {
  const candidates = process.env.FIXITRY_PYTHON
    ? [process.env.FIXITRY_PYTHON]
    : process.platform === "win32"
      ? ["python"]
      : ["python3.13", "python3.12", "python3.11", "python3.10", "python3"];
  for (const candidate of [...new Set(candidates)]) {
    const result = await run(candidate, ["--version"], { timeoutMs: 10_000, env });
    if (result.exitCode !== 0) continue;
    const version = (result.stdout + result.stderr).match(/Python 3\.(\d+)\./);
    if (version && Number(version[1]) >= 8 && Number(version[1]) <= 13) return candidate;
  }
  throw new Error("The demo's pinned pytest requires Python 3.8–3.13; set FIXITRY_PYTHON to a compatible interpreter");
}

export async function runPythonTests(repoDir: string, jobDir: string): Promise<TestResult> {
  const venvDir = path.join(jobDir, "venv");
  const isWindows = process.platform === "win32";
  const python = path.join(venvDir, isWindows ? "Scripts" : "bin", isWindows ? "python.exe" : "python");
  const env = childEnv({ PYTHONDONTWRITEBYTECODE: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  const systemPython = await choosePython(env);
  const steps = [
    { label: `create venv with ${systemPython}`, cmd: systemPython, args: ["-m", "venv", venvDir], timeoutMs: 120_000 },
    { label: "install dependencies", cmd: python, args: ["-m", "pip", "install", "-r", "requirements.txt"], timeoutMs: 300_000 },
    { label: "run tests", cmd: python, args: ["-m", "pytest", "-q", "-p", "no:cacheprovider"], timeoutMs: 180_000 },
  ];

  let output = "";
  for (const step of steps) {
    const result = await run(step.cmd, step.args, { cwd: repoDir, timeoutMs: step.timeoutMs, maxBytes: 2_000_000, env });
    output += `$ ${step.label} (exit ${result.exitCode}${result.timedOut ? ", timed out" : ""})\n${(result.stdout + result.stderr).slice(-1500)}\n`;
    if (result.exitCode !== 0) return { passed: false, output: output.slice(-6000) };
  }
  return { passed: true, output: output.slice(-6000) };
}
