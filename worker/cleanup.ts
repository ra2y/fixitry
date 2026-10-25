import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";

export function assertInsideWorkRoot(p: string): string {
  const resolved = path.resolve(p);
  const root = path.resolve(config.workRoot) + path.sep;
  if (!resolved.startsWith(root)) throw new Error(`Refusing to touch path outside work root: ${resolved}`);
  return resolved;
}

export async function removeJobDir(jobDir: string): Promise<void> {
  if (config.keepTmp) {
    console.warn(`FIXITRY_KEEP_TMP=1: leaving ${jobDir} on disk (debugging only)`);
    return;
  }
  const resolved = assertInsideWorkRoot(jobDir);
  if (!path.basename(resolved).startsWith("job-")) throw new Error("Unexpected job directory name");
  await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export async function sweepOldJobDirs(maxAgeMs = 60 * 60_000): Promise<void> {
  let names: string[] = [];
  try { names = await readdir(config.workRoot); } catch { return; }
  for (const n of names.filter((x) => x.startsWith("job-"))) {
    const p = path.join(config.workRoot, n);
    if (Date.now() - (await stat(p)).mtimeMs > maxAgeMs) await removeJobDir(p);
  }
}
