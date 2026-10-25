import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { branchNameForJob } from "../../shared/branch";

export function PushApprovalPanel({ jobId }: { jobId: Id<"jobs"> }) {
  const job = useQuery(api.jobs.get, { jobId });
  const attempts = useQuery(api.repairAttempts.listByJob, { jobId });
  const findings = useQuery(api.findings.listByJob, { jobId });
  const approvePush = useMutation(api.jobs.approvePush);
  const declinePush = useMutation(api.jobs.declinePush);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!job) return null;
  if (job.pullRequestUrl) {
    return (
      <section>
        <h3>Pull request opened</h3>
        <p>Branch: <code>{job.branchName}</code></p>
        <a href={job.pullRequestUrl} target="_blank" rel="noreferrer">View pull request</a>
      </section>
    );
  }
  if (job.status !== "awaiting_push_approval") return null;

  const attempt = attempts?.[attempts.length - 1];
  const finding = findings?.find((item) => item._id === job.selectedFindingId);
  const branchName = job.branchName ?? branchNameForJob(job._id);

  async function act(action: "approve" | "decline") {
    setBusy(true);
    setError(null);
    try {
      if (action === "approve") await approvePush({ jobId });
      else await declinePush({ jobId });
    } catch (caught) {
      setError(caught instanceof ConvexError ? String(caught.data) : "Push decision failed");
    } finally {
      setBusy(false);
    }
  }

  if (!attempt || attempt.status !== "succeeded" || !attempt.patch || attempt.patchTruncated) {
    return <p>Push approval is unavailable because the verified patch is missing or truncated.</p>;
  }

  return (
    <section style={{ border: "2px solid #f59e0b", padding: "1rem" }}>
      <h3>Second approval: open a pull request</h3>
      <p>This is a separate approval. Fixitry will re-clone the repository, re-apply this exact patch, and push only the generated branch.</p>
      <p><b>Repository:</b> {job.repoUrl}</p>
      <p><b>Branch:</b> <code>{branchName}</code></p>
      <p><b>Finding:</b> {finding?.title ?? "Selected finding"}</p>
      <details>
        <summary>Review exact patch</summary>
        <pre style={{ overflowX: "auto" }}>{attempt.patch}</pre>
      </details>
      <button disabled={busy} onClick={() => void act("approve")}>Approve push and open PR</button>{" "}
      <button disabled={busy} onClick={() => void act("decline")}>Decline push</button>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </section>
  );
}
