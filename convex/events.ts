import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertWorker } from "./lib/auth";

export const add = mutation({
  args: {
    secret: v.string(),
    jobId: v.id("jobs"),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    source: v.union(v.literal("worker"), v.literal("trivy"), v.literal("droid"), v.literal("tests"), v.literal("semgrep"), v.literal("zap")),
    message: v.string(),
  },
  handler: async (ctx, { secret, message, ...rest }) => {
    assertWorker(secret);
    await ctx.db.insert("events", { ...rest, message: message.slice(0, 2000) });
  },
});

export const listByJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db
      .query("events")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .take(500);
  },
});
