import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertWorker } from "./lib/auth";
import type { Doc } from "./_generated/dataModel";
import { jobStatus } from "./schema";

type Status = Doc<"jobs">["status"];

const NEXT: Partial<Record<Status, Status[]>> = {
  pending: ["cloning"],
  cloning: ["scanning"],
  scanning: ["awaiting_approval", "completed"],
  awaiting_approval: ["approved"],
  approved: ["repairing"],
  repairing: ["testing"],
  testing: ["verifying"],
  verifying: ["completed"],
};

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

export const claimNext = mutation({
  args: { secret: v.string(), workerId: v.string() },
  handler: async (ctx, { secret, workerId }) => {
    assertWorker(secret);

    const pending = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();
    if (pending) {
      await ctx.db.patch(pending._id, { status: "cloning", claimedBy: workerId });
      return { kind: "scan" as const, job: (await ctx.db.get(pending._id))! };
    }

    const approved = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .first();
    if (approved) {
      await ctx.db.patch(approved._id, { status: "repairing", claimedBy: workerId });
      return { kind: "repair" as const, job: (await ctx.db.get(approved._id))! };
    }
    return null;
  },
});

export const setStatus = mutation({
  args: {
    secret: v.string(),
    jobId: v.id("jobs"),
    status: jobStatus,
    error: v.optional(v.string()),
  },
  handler: async (ctx, { secret, jobId, status, error }) => {
    assertWorker(secret);
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found");
    if (job.status === "completed" || job.status === "failed") {
      throw new Error(`Job already ${job.status}`);
    }
    if (status !== "failed" && !NEXT[job.status]?.includes(status)) {
      throw new Error(`Illegal transition ${job.status} -> ${status}`);
    }
    await ctx.db.patch(jobId, {
      status,
      ...(error ? { error: error.slice(0, 1000) } : {}),
    });
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
