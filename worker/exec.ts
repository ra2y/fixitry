import { execFile } from "node:child_process";

export type RunResult = { stdout: string; stderr: string; exitCode: number; timedOut: boolean };

const SECRET_NAMES = ["WORKER_SECRET", "FACTORY_API_KEY", "GITHUB_TOKEN"];

export function childEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of SECRET_NAMES) delete env[name];
  return { ...env, ...extra };
}

export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs: number; maxBytes?: number; env?: NodeJS.ProcessEnv },
): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      {
        cwd: opts.cwd,
        timeout: opts.timeoutMs,
        maxBuffer: opts.maxBytes ?? 5 * 1024 * 1024,
        env: opts.env ?? childEnv(),
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (!error) return resolve({ stdout, stderr, exitCode: 0, timedOut: false });
        const e = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string };
        resolve({
          stdout,
          stderr: stderr || e.message,
          exitCode: typeof e.code === "number" ? e.code : 1,
          timedOut: e.killed === true && e.signal === "SIGTERM",
        });
      },
    );
  });
}