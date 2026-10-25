import assert from "node:assert/strict";
import { test } from "node:test";
import { assertGeneratedBranchName, branchNameForJob } from "../shared/branch";

process.env.CONVEX_URL ??= "https://example.convex.cloud";
process.env.WORKER_SECRET ??= "phase18-test-secret";
process.env.FACTORY_API_KEY ??= "phase18-test-factory-key";
process.env.DEMO_REPOSITORY_URL ??= "https://github.com/example/demo";

test("push branches are generated and cannot target the default branch", () => {
  const branch = branchNameForJob("j1234567890abcdef");
  assert.equal(branch, "fixitry/fix-567890abcdef");
  assert.doesNotThrow(() => assertGeneratedBranchName(branch));
  assert.throws(() => assertGeneratedBranchName("main"), /generated Fixitry branch/);
});

test("a tampered patch is rejected when it changes an extra file", () => {
  // Load the worker module only after test-only environment values exist.
  return import("./github").then(({ assertAllowedFiles }) => {
  assert.doesNotThrow(() => assertAllowedFiles(["requirements.txt"], ["requirements.txt"]));
  assert.throws(
    () => assertAllowedFiles(["requirements.txt", "extra.txt"], ["requirements.txt"]),
    /outside the approved list/,
  );
  });
});
