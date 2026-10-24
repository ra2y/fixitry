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

export default defineSchema({
  jobs: defineTable({
    repoUrl: v.string(),
    status: jobStatus,
    error: v.optional(v.string()),
    claimedBy: v.optional(v.string()),
  }).index("by_status", ["status"]),
  events: defineTable({
  jobId: v.id("jobs"),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    source: v.union(v.literal("worker"), v.literal("trivy"), v.literal("droid"), v.literal("tests")),
    message: v.string(),
  }).index("by_job", ["jobId"]),
});
