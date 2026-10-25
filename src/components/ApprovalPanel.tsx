import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Guide } from "./Guide";

type Props = { jobId: Id<"jobs">; findingId: Id<"findings"> | null };

export function ApprovalPanel({ jobId, findingId }: Props) {
  const job = useQuery(api.jobs.get, { jobId });
  const approve = useMutation(api.jobs.approveFinding);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!job || job.status !== "awaiting_approval") return null;

  async function onApprove() {
    if (!findingId) return;
    setError(null);
    try {
      await approve({ jobId, findingId });
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "Approval failed");
    }
  }

  return (
    <section className="approval-section">
      <div className="section-kicker">APPROVAL REQUIRED</div>
      <h3>Approve a repair</h3>
      <p>{findingId ? "Fixitry will attempt a repair for this finding in a temporary copy." : "Select a finding to enable this action."}</p>
      <label className="checkbox-label">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>I understand this repair edits a temporary copy. Nothing is pushed.</span>
      </label>
      <button className="primary-button" disabled={!findingId || !ack} onClick={onApprove}>Approve repair</button>
      {error && <Guide title="Approval failed" message={error} tone="error" />}
    </section>
  );
}
