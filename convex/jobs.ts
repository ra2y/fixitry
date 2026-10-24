import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertWorker } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").order("desc").take(20);
  },
});

// TEMPORARY: replaced by a validated `create` in Phase 6.
export const createTest = mutation({
  args: { repoUrl: v.string() },
  handler: async (ctx, { repoUrl }) => {
    return await ctx.db.insert("jobs", { repoUrl, status: "pending" });
  },
});

export const workerPing = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    assertWorker(secret);
    const pending = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return { ok: true, pendingCount: pending.length };
  },
});
