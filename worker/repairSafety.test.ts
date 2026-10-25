import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

process.env.CONVEX_URL = "https://example.convex.cloud";
process.env.WORKER_SECRET = "test-only-secret";
process.env.FACTORY_API_KEY = "test-only-factory-key";
process.env.DEMO_REPOSITORY_URL = "https://github.com/example/demo";

test("approved paths cannot escape the cloned repository", async () => {
  const { allowedFilesFor } = await import("./droid");
  const finding = {
    fingerprint: "f", kind: "vulnerability" as const, severity: "HIGH" as const,
    ruleId: "rule", title: "test", target: "../outside.txt", description: "test",
  };
  assert.throws(() => allowedFilesFor(finding), /safe relative file path/);
  assert.deepEqual(allowedFilesFor({ ...finding, target: "requirements.txt" }), ["requirements.txt"]);
});

test("the worker detects and reverts unauthorized changes in a disposable clone", async () => {
  const { createJobDir, changedFiles, revertAll, stagedPatch } = await import("./repository");
  const { removeJobDir } = await import("./cleanup");
  const { mkdir } = await import("node:fs/promises");
  const { run } = await import("./exec");
  const jobDir = await createJobDir();
  const repoDir = path.join(jobDir, "repo");
  const git = async (args: string[]) => {
    const result = await run("git", args, { cwd: repoDir, timeoutMs: 15_000 });
    assert.equal(result.exitCode, 0, result.stderr);
  };
  try {
    await mkdir(repoDir);
    await git(["init", "-q"]);
    await writeFile(path.join(repoDir, "requirements.txt"), "package==1.0\n");
    await git(["add", "requirements.txt"]);
    await git(["-c", "user.name=Fixitry Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "baseline"]);

    await writeFile(path.join(repoDir, "requirements.txt"), "package==2.0\n");
    await writeFile(path.join(repoDir, "outside.txt"), "unauthorized\n");
    assert.deepEqual((await changedFiles(repoDir)).sort(), ["outside.txt", "requirements.txt"]);
    await revertAll(repoDir);
    assert.deepEqual(await changedFiles(repoDir), []);
    assert.equal(await readFile(path.join(repoDir, "requirements.txt"), "utf8"), "package==1.0\n");

    await writeFile(path.join(repoDir, "requirements.txt"), "package==2.0\n");
    const result = await stagedPatch(repoDir);
    assert.equal(result.truncated, false);
    assert.match(result.patch, /\+package==2\.0/);
  } finally {
    await removeJobDir(jobDir);
  }
});
