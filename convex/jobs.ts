import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").order("desc").collect();
  },
});

export const create = mutation({
  args: { repositoryUrl: v.string() },
  handler: async (ctx, { repositoryUrl }) => {
    const normalizedUrl = repositoryUrl.trim();
    if (!normalizedUrl) {
      throw new Error("Repository URL is required.");
    }

    return await ctx.db.insert("jobs", {
      repositoryUrl: normalizedUrl,
      status: "queued",
    });
  },
});
