import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { isAllowed, parseGithubRepoUrl } from "../convex/lib/repoUrl";
import { config } from "./config";
import { childEnv, run } from "./exec";

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