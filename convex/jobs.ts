import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertWorker } from "./lib/auth";
import type { Doc } from "./_generated/dataModel";
import { jobStatus, zapMode } from "./schema";
import { isAllowed, parseGithubRepoUrl } from "./lib/repoUrl";
import { assertGeneratedBranchName, branchNameForJob } from "../shared/branch";

type Status = Doc<"jobs">["status"];

const NEXT: Partial<Record<Status, Status[]>> = {
  pending: ["cloning"],
  cloning: ["scanning"],
  scanning: ["awaiting_approval", "completed"],
  awaiting_approval: ["approved"],
  approved: ["repairing"],
  repairing: ["testing", "completed"],
  testing: ["verifying", "completed"],
  verifying: ["completed", "awaiting_push_approval"],
  awaiting_push_approval: ["pushing", "completed"],
  pushing: ["completed"],
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").order("desc").take(20);
  },
});

export const create = mutation({
  args: { repoUrl: v.string(), zapMode: v.optional(zapMode) },
  handler: async (ctx, { repoUrl, zapMode: mode }) => {
    const allowlist = (process.env.ALLOWED_REPOSITORIES ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const busy = await Promise.all(
      (["pending", "cloning", "scanning", "approved", "repairing", "testing", "verifying", "awaiting_push_approval", "pushing"] as const).map((s) =>
        ctx.db.query("jobs").withIndex("by_status", (q) => q.eq("status", s)).first()),
    );
    if (busy.some(Boolean)) throw new ConvexError("Another job is in progress");
    try {
      if (!isAllowed(repoUrl, allowlist)) throw new Error("Repository is not on the allowlist");
      const { canonicalUrl } = parseGithubRepoUrl(repoUrl);
      return await ctx.db.insert("jobs", { repoUrl: canonicalUrl, status: "pending", zapMode: mode ?? "off" });
    } catch (error) {
      throw new ConvexError(error instanceof Error ? error.message : "Invalid repository");
    }
  },
});

export const claimNext = mutation({
  args: { secret: v.string(), workerId: v.string(), supportsZap: v.optional(v.boolean()) },
  handler: async (ctx, { secret, workerId, supportsZap }) => {
    assertWorker(secret);
    const usable = (j: Doc<"jobs">) => supportsZap === true || !j.zapMode || j.zapMode === "off";

    const pendingJobs = await ctx.db.query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "pending")).take(20);
    const pending = pendingJobs.find(usable);
    if (pending) {
      await ctx.db.patch(pending._id, { status: "cloning", claimedBy: workerId });
      return { kind: "scan" as const, job: (await ctx.db.get(pending._id))! };
    }

    const approvedJobs = await ctx.db.query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "approved")).take(20);
    const approved = approvedJobs.find(usable);
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
    for (const s of ["cloning", "scanning", "repairing", "testing", "verifying", "pushing"] as const) {
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
  args: { jobId: v.id("jobs"), findingId: v.id("findings"), allowedFiles: v.optional(v.array(v.string())) },
  handler: async (ctx, { jobId, findingId, allowedFiles }) => {
    const job = await ctx.db.get(jobId);
    if (!job) throw new ConvexError("Job not found");
    if (job.status !== "awaiting_approval") throw new ConvexError(`Job is ${job.status}, not awaiting approval`);

    const finding = await ctx.db.get(findingId);
    if (!finding || finding.jobId !== jobId || finding.scanRound !== "initial") {
      throw new ConvexError("Finding does not belong to this job");
    }
    let approvedFiles: string[] | undefined;
    if (finding.source === "zap") {
      const offered = new Set(job.repoFiles ?? []);
      const chosen = [...new Set(allowedFiles ?? [])];
      if (chosen.length < 1 || chosen.length > 3) throw new ConvexError("Choose 1 to 3 files the agent may edit");
      if (chosen.some((f) => !offered.has(f))) throw new ConvexError("One of the chosen files is not available for editing");
      approvedFiles = chosen;
    } else if (allowedFiles && allowedFiles.length > 0) {
      throw new ConvexError("File selection applies only to web-scan findings");
    }

    await ctx.db.patch(jobId, {
      status: "approved",
      selectedFindingId: findingId,
      approvedAt: Date.now(),
      ...(approvedFiles ? { approvedFiles } : {}),
    });
  },
});

export const approvePush = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) throw new ConvexError("Job not found");
    if (job.status !== "awaiting_push_approval") {
      throw new ConvexError(`Job is ${job.status}, not awaiting push approval`);
    }

    const attempt = await ctx.db.query("repairAttempts")
      .withIndex("by_job", (q) => q.eq("jobId", jobId)).first();
    if (!attempt || attempt.status !== "succeeded" || attempt.patchTruncated) {
      throw new ConvexError("This repair is not eligible for pushing");
    }

    const branchName = branchNameForJob(jobId);
    await ctx.db.patch(jobId, { status: "pushing", branchName });
    return branchName;
  },
});

export const declinePush = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) throw new ConvexError("Job not found");
    if (job.status !== "awaiting_push_approval") {
      throw new ConvexError(`Job is ${job.status}, not awaiting push approval`);
    }
    await ctx.db.patch(jobId, { status: "completed" });
  },
});

export const markPushComplete = mutation({
  args: {
    secret: v.string(),
    jobId: v.id("jobs"),
    branchName: v.string(),
    pullRequestUrl: v.string(),
  },
  handler: async (ctx, { secret, jobId, branchName, pullRequestUrl }) => {
    assertWorker(secret);
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "pushing") throw new Error("Job is not being pushed");
    if (branchName !== branchNameForJob(jobId)) throw new Error("Unexpected push branch");
    assertGeneratedBranchName(branchName);
    if (!pullRequestUrl.startsWith("https://github.com/")) throw new Error("Unexpected pull request URL");
    await ctx.db.patch(jobId, { status: "completed", branchName, pullRequestUrl });
  },
});

export const getFinding = query({
  args: { secret: v.string(), findingId: v.id("findings") },
  handler: async (ctx, { secret, findingId }) => {
    assertWorker(secret);
    return await ctx.db.get(findingId);
  },
});

export const setRepoFiles = mutation({
  args: { secret: v.string(), jobId: v.id("jobs"), files: v.array(v.string()) },
  handler: async (ctx, { secret, jobId, files }) => {
    assertWorker(secret);
    await ctx.db.patch(jobId, { repoFiles: files.slice(0, 1000) });
  },
});