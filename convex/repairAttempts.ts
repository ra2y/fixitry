import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";
import { assertWorker } from "./lib/auth";

export const start = mutation({
  args: { secret: v.string(), jobId: v.id("jobs"), findingId: v.id("findings") },
  returns: v.id("repairAttempts"),
  handler: async (ctx, { secret, jobId, findingId }) => {
    assertWorker(secret);
    const job = await ctx.db.get(jobId);
    const finding = await ctx.db.get(findingId);
    if (!job || job.status !== "repairing" || job.selectedFindingId !== findingId) {
      throw new Error("Job is not repairing this approved finding");
    }
    if (!finding || finding.jobId !== jobId || finding.scanRound !== "initial") {
      throw new Error("Approved finding does not belong to this job");
    }
    const existing = await ctx.db.query("repairAttempts")
      .withIndex("by_job", (q) => q.eq("jobId", jobId)).first();
    if (existing) throw new Error("Repair attempt already exists for this job");
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
  returns: v.null(),
  handler: async (ctx, { secret, attemptId, ...fields }) => {
    assertWorker(secret);
    const attempt = await ctx.db.get(attemptId);
    if (!attempt || attempt.status !== "running") throw new Error("Repair attempt is not running");
    const updates = { ...fields };
    if (updates.summary !== undefined) updates.summary = updates.summary.slice(0, 4000);
    if (updates.patch !== undefined) {
      if (updates.patch.length > 200_000) updates.patchTruncated = true;
      updates.patch = updates.patch.slice(0, 200_000);
    }
    if (updates.error !== undefined) updates.error = updates.error.slice(0, 1000);
    if (updates.testOutput !== undefined) updates.testOutput = updates.testOutput.slice(0, 4000);
    await ctx.db.patch(attemptId, updates);
    return null;
  },
});

export const listByJob = query({
  args: { jobId: v.id("jobs") },
  returns: v.array(schema.doc("repairAttempts")),
  handler: async (ctx, { jobId }) => await ctx.db.query("repairAttempts")
    .withIndex("by_job", (q) => q.eq("jobId", jobId)).take(20),
});
