import assert from "node:assert/strict";
import test from "node:test";
import { compareFindings } from "./compare";

test("comparison separates resolved, remaining, and introduced findings by fingerprint", () => {
  const before = [{ fingerprint: "fixed" }, { fingerprint: "unchanged" }];
  const after = [{ fingerprint: "unchanged" }, { fingerprint: "new" }];
  const result = compareFindings(before, after);
  assert.deepEqual(result.resolved, [before[0]]);
  assert.deepEqual(result.remaining, [before[1]]);
  assert.deepEqual(result.introduced, [after[1]]);
});
