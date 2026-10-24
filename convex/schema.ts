import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const jobStatus = v.union(
  v.literal("pending"),
  v.literal("cloning"),
  v.literal("scanning"),
  v.literal("awaiting_approval"),
  v.literal("approved"),
  v.literal("repairing"),
  v.literal("testing"),
  v.literal("verifying"),
  v.literal("completed"),
  v.literal("failed"),
);

export const findingFields = {
  fingerprint: v.string(),
  kind: v.union(v.literal("vulnerability"), v.literal("secret"), v.literal("misconfiguration")),
  severity: v.union(v.literal("CRITICAL"), v.literal("HIGH"), v.literal("MEDIUM"), v.literal("LOW"), v.literal("UNKNOWN")),
  ruleId: v.string(),
  title: v.string(),
  target: v.string(),
  description: v.string(),
  startLine: v.optional(v.number()),
  packageName: v.optional(v.string()),
  installedVersion: v.optional(v.string()),
  fixedVersion: v.optional(v.string()),
};

export default defineSchema({
  jobs: defineTable({
    repoUrl: v.string(),
    status: jobStatus,
    error: v.optional(v.string()),
    claimedBy: v.optional(v.string()),
    selectedFindingId: v.optional(v.id("findings")),
    approvedAt: v.optional(v.number()),
    commitSha: v.optional(v.string()),
  }).index("by_status", ["status"]),
  events: defineTable({
  jobId: v.id("jobs"),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    source: v.union(v.literal("worker"), v.literal("trivy"), v.literal("droid"), v.literal("tests")),
    message: v.string(),
  }).index("by_job", ["jobId"]),
  findings: defineTable({
    jobId: v.id("jobs"),
    scanRound: v.union(v.literal("initial"), v.literal("verification")),
    ...findingFields,
  }).index("by_job_round", ["jobId", "scanRound"]),
});
