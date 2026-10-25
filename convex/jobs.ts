import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertWorker } from "./lib/auth";
import type { Doc } from "./_generated/dataModel";
import { jobStatus } from "./schema";
import { isAllowed, parseGithubRepoUrl } from "./lib/repoUrl";

type Status = Doc<"jobs">["status"];

const NEXT: Partial<Record<Status, Status[]>> = {
  pending: ["cloning"],
  cloning: ["scanning"],
  scanning: ["awaiting_approval", "completed"],
  awaiting_approval: ["approved"],
  approved: ["repairing"],
  repairing: ["testing", "completed"],
  testing: ["verifying", "completed"],
  verifying: ["completed"],
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").order("desc").take(20);
  },
});

export const create = mutation({
  args: { repoUrl: v.string() },
  handler: async (ctx, { repoUrl }) => {
    const allowlist = (process.env.ALLOWED_REPOSITORIES ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const busy = await Promise.all(
      (["pending", "cloning", "scanning", "approved", "repairing", "testing", "verifying"] as const).map((s) =>
        ctx.db.query("jobs").withIndex("by_status", (q) => q.eq("status", s)).first()),
    );
    if (busy.some(Boolean)) throw new ConvexError("Another job is in progress");
    try {
      if (!isAllowed(repoUrl, allowlist)) throw new Error("Repository is not on the allowlist");
      const { canonicalUrl } = parseGithubRepoUrl(repoUrl);
      return await ctx.db.insert("jobs", { repoUrl: canonicalUrl, status: "pending" });
    } catch (error) {
      throw new ConvexError(error instanceof Error ? error.message : "Invalid repository");
    }
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

export const failOrphans = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    assertWorker(secret);
    for (const s of ["cloning", "scanning", "repairing", "testing", "verifying"] as const) {
      const stuck = await ctx.db.query("jobs").withIndex("by_status", (q) => q.eq("status", s)).collect();
      for (const j of stuck) await ctx.db.patch(j._id, { status: "failed", error: "Worker restarted during this job" });
    }
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

export const get = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => await ctx.db.get(jobId),
});

export const setCommit = mutation({
  args: { secret: v.string(), jobId: v.id("jobs"), commitSha: v.string() },
  handler: async (ctx, { secret, jobId, commitSha }) => {
    assertWorker(secret);
    await ctx.db.patch(jobId, { commitSha });
  },
});

export const approveFinding = mutation({
  args: { jobId: v.id("jobs"), findingId: v.id("findings") },
  handler: async (ctx, { jobId, findingId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) throw new ConvexError("Job not found");
    if (job.status !== "awaiting_approval") throw new ConvexError(`Job is ${job.status}, not awaiting approval`);

    const finding = await ctx.db.get(findingId);
    if (!finding || finding.jobId !== jobId || finding.scanRound !== "initial") {
      throw new ConvexError("Finding does not belong to this job");
    }
    await ctx.db.patch(jobId, { status: "approved", selectedFindingId: findingId, approvedAt: Date.now() });
  },
});

export const getFinding = query({
  args: { secret: v.string(), findingId: v.id("findings") },
  handler: async (ctx, { secret, findingId }) => {
    assertWorker(secret);
    return await ctx.db.get(findingId);
  },
});