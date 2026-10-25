import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { isAllowed, parseGithubRepoUrl } from "../convex/lib/repoUrl";
import { config } from "./config";
import { childEnv, run } from "./exec";
import { assertInsideWorkRoot } from "./cleanup";
import { filterEditable } from "./repoFiles";

export async function createJobDir(): Promise<string> {
  await mkdir(config.workRoot, { recursive: true });
  return await mkdtemp(path.join(config.workRoot, "job-"));
}

export async function cloneRepo(repoUrl: string, jobDir: string): Promise<string> {
  if (!isAllowed(repoUrl, config.allowedRepositories)) {
    throw new Error("Repository is not on the worker allowlist");
  }
  const { canonicalUrl } = parseGithubRepoUrl(repoUrl);
  const repoDir = path.join(jobDir, "repo");

  const res = await run(
    "git",
    ["clone", "--depth", "1", "--single-branch", "--no-tags", "--", canonicalUrl, repoDir],
    { timeoutMs: 120_000, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }) },
  );
  if (res.exitCode !== 0) {
    throw new Error(`git clone failed${res.timedOut ? " (timed out)" : ""}: ${res.stderr.slice(0, 500)}`);
  }
  return repoDir;
}

export async function headSha(repoDir: string): Promise<string> {
  const res = await run("git", ["rev-parse", "HEAD"], { cwd: repoDir, timeoutMs: 10_000 });
  if (res.exitCode !== 0) throw new Error("git rev-parse failed");
  return res.stdout.trim();
}

export async function changedFiles(repoDir: string): Promise<string[]> {
  assertInsideWorkRoot(repoDir);
  const res = await run("git", ["status", "--porcelain=v1", "-z", "-uall"], {
    cwd: repoDir, timeoutMs: 15_000,
  });
  if (res.exitCode !== 0) throw new Error("git status failed");

  const entries = res.stdout.split("\0");
  const files = new Set<string>();
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry) continue;
    if (entry.length < 4 || entry[2] !== " ") throw new Error("Unexpected git status output");
    files.add(entry.slice(3).replace(/\\/g, "/"));
    if (/[RC]/.test(entry.slice(0, 2))) {
      const previousPath = entries[++i];
      if (!previousPath) throw new Error("Missing renamed path in git status");
      files.add(previousPath.replace(/\\/g, "/"));
    }
  }
  return [...files];
}

export async function revertAll(repoDir: string): Promise<void> {
  assertInsideWorkRoot(repoDir);
  for (const args of [["reset", "--hard"], ["clean", "-fd"]]) {
    const res = await run("git", args, { cwd: repoDir, timeoutMs: 30_000 });
    if (res.exitCode !== 0) throw new Error(`git ${args[0]} failed`);
  }
}

export async function stagedPatch(repoDir: string): Promise<{ patch: string; truncated: boolean }> {
  assertInsideWorkRoot(repoDir);
  const add = await run("git", ["add", "-A", "--"], { cwd: repoDir, timeoutMs: 30_000 });
  if (add.exitCode !== 0) throw new Error("git add failed");
  const diff = await run("git", ["diff", "--cached", "--binary", "--no-ext-diff"], {
    cwd: repoDir, timeoutMs: 30_000, maxBytes: 5_000_000,
  });
  if (diff.exitCode !== 0) throw new Error("git diff failed or exceeded size limit");
  const limit = 200_000;
  return { patch: diff.stdout.slice(0, limit), truncated: diff.stdout.length > limit };
}

export async function listRepoFiles(repoDir: string): Promise<string[]> {
  const res = await run("git", ["ls-files", "-z"], { cwd: repoDir, timeoutMs: 15_000, maxBytes: 5_000_000 });
  if (res.exitCode !== 0) throw new Error("git ls-files failed");
  return filterEditable(res.stdout.split("\0").filter(Boolean));
}