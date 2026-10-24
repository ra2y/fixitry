import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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