import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertWorker } from "./lib/auth";
import { findingFields } from "./schema";

export const addBatch = mutation({
  args: {
    secret: v.string(),
    jobId: v.id("jobs"),
    scanRound: v.union(v.literal("initial"), v.literal("verification")),
    findings: v.array(v.object(findingFields)),
  },
  handler: async (ctx, { secret, jobId, scanRound, findings }) => {
    assertWorker(secret);
    if (findings.length > 100) throw new Error("Batch too large");
    for (const f of findings) await ctx.db.insert("findings", { jobId, scanRound, ...f });
  },
});

export const listByJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db
      .query("findings")
      .withIndex("by_job_round", (q) => q.eq("jobId", jobId))
      .take(1000);
  },
});