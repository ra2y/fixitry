import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { isAllowed, parseGithubRepoUrl } from "../convex/lib/repoUrl";
import { config } from "./config";
import { childEnv, run } from "./exec";
import { assertInsideWorkRoot } from "./cleanup";

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^"|"$/g, "");

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
  const res = await run("git", ["status", "--porcelain=v1", "-uall"], { cwd: repoDir, timeoutMs: 15_000 });
  return res.stdout.split(/\r?\n/).filter(Boolean)
    .flatMap((line) => line.slice(3).split(" -> ")).map(norm);
}

export async function revertAll(repoDir: string): Promise<void> {
  assertInsideWorkRoot(repoDir); // never run reset/clean outside our temp area
  await run("git", ["reset", "--hard"], { cwd: repoDir, timeoutMs: 30_000 });
  await run("git", ["clean", "-fd"], { cwd: repoDir, timeoutMs: 30_000 });
}

export async function stagedPatch(repoDir: string): Promise<{ patch: string; truncated: boolean }> {
  await run("git", ["add", "-A"], { cwd: repoDir, timeoutMs: 30_000 });
  const res = await run("git", ["diff", "--cached", "--binary"], { cwd: repoDir, timeoutMs: 30_000, maxBytes: 5_000_000 });
  const CAP = 200_000;
  return { patch: res.stdout.slice(0, CAP), truncated: res.stdout.length > CAP };
}