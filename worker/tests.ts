import path from "node:path";
import { childEnv, run } from "./exec";

export type TestResult = { passed: boolean; output: string };
const isWin = process.platform === "win32";

type PythonCmd = { cmd: string; args: string[]; label: string };

// The demo pins old packages (pytest 7.1.2, Werkzeug 2.0.2) that use ast.Str, which Python 3.14 removed.
const MAX_MINOR = 13;
const MIN_MINOR = 9;
const VERSION_CHECK = `import sys; sys.exit(0 if (3, ${MIN_MINOR}) <= sys.version_info[:2] <= (3, ${MAX_MINOR}) else 1)`;

function candidates(): PythonCmd[] {
  const minors = Array.from({ length: MAX_MINOR - MIN_MINOR + 1 }, (_, i) => MAX_MINOR - i);
  const list: PythonCmd[] = isWin
    ? minors.map((m) => ({ cmd: "py", args: [`-3.${m}`], label: `py -3.${m}` }))
    : minors.map((m) => ({ cmd: `python3.${m}`, args: [], label: `python3.${m}` }));
  const fallback = isWin ? "python" : "python3";
  list.push({ cmd: fallback, args: [], label: fallback });
  return list;
}

let cachedPython: PythonCmd | null = null;

// FIXITRY_PYTHON overrides detection; otherwise use the newest installed Python from 3.9 to 3.13.
async function findPython(): Promise<PythonCmd> {
  if (process.env.FIXITRY_PYTHON) {
    return { cmd: process.env.FIXITRY_PYTHON, args: [], label: process.env.FIXITRY_PYTHON };
  }
  if (cachedPython) return cachedPython;
  for (const c of candidates()) {
    const r = await run(c.cmd, [...c.args, "-c", VERSION_CHECK], { timeoutMs: 15_000 });
    if (r.exitCode === 0) return (cachedPython = c);
  }
  throw new Error(
    `No compatible Python found. Install Python 3.${MIN_MINOR} to 3.${MAX_MINOR}, or set FIXITRY_PYTHON to its python executable.`,
  );
}

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
  let systemPython: PythonCmd;
  try {
    systemPython = await findPython();
  } catch (e) {
    return { passed: false, output: e instanceof Error ? e.message : String(e) };
  }
  const env = childEnv({
    PYTHONDONTWRITEBYTECODE: "1",
    PIP_DISABLE_PIP_VERSION_CHECK: "1",
  });

  const steps = [
    {
      label: `create venv with ${systemPython.label}`,
      cmd: systemPython.cmd,
      args: [...systemPython.args, "-m", "venv", venvDir],
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
