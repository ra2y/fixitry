import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertWorker } from "./lib/auth";

export const start = mutation({
  args: { secret: v.string(), jobId: v.id("jobs"), findingId: v.id("findings") },
  handler: async (ctx, { secret, jobId, findingId }) => {
    assertWorker(secret);
    return await ctx.db.insert("repairAttempts", { jobId, findingId, status: "running" });
  },
});

export const finish = mutation({
  args: {
    secret: v.string(),
    attemptId: v.id("repairAttempts"),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    summary: v.optional(v.string()),
    filesChanged: v.optional(v.array(v.string())),
    patch: v.optional(v.string()),
    patchTruncated: v.optional(v.boolean()),
    testsPassed: v.optional(v.boolean()),
    testOutput: v.optional(v.string()),
    resolvedCount: v.optional(v.number()),
    remainingCount: v.optional(v.number()),
    newCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { secret, attemptId, ...fields }) => {
    assertWorker(secret);
    await ctx.db.patch(attemptId, fields);
  },
});

export const listByJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) =>
    await ctx.db.query("repairAttempts").withIndex("by_job", (q) => q.eq("jobId", jobId)).take(20),
});