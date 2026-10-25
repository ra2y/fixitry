import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { branchNameForJob } from "../../shared/branch";
import { Guide } from "./Guide";

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
      <section className="content-panel publish-panel">
        <div className="section-kicker">PUBLISHED</div>
        <h3>Pull request opened</h3>
        <p>Branch: <code>{job.branchName}</code></p>
        <a className="text-link" href={job.pullRequestUrl} target="_blank" rel="noreferrer">View pull request ↗</a>
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
    return <Guide title="Push unavailable" message="The verified patch is missing or truncated, so this change cannot be pushed." tone="error" />;
  }

  return (
    <section className="content-panel publish-panel">
      <div className="section-kicker">SECOND APPROVAL REQUIRED</div>
      <h3>Open a pull request</h3>
      <p>This is a separate approval. Fixitry will re-clone the repository, re-apply this exact patch, and push only the generated branch.</p>
      <dl className="detail-list"><div><dt>Repository</dt><dd>{job.repoUrl}</dd></div><div><dt>Branch</dt><dd><code>{branchName}</code></dd></div><div><dt>Finding</dt><dd>{finding?.title ?? "Selected finding"}</dd></div></dl>
      <details>
        <summary>Review exact patch</summary>
        <pre className="plain-patch">{attempt.patch}</pre>
      </details>
      <div className="button-row"><button className="primary-button" disabled={busy} onClick={() => void act("approve")}>Approve push and open PR</button><button className="secondary-button" disabled={busy} onClick={() => void act("decline")}>Decline push</button></div>
      {error && <Guide title="Push decision failed" message={error} tone="error" />}
    </section>
  );
}
