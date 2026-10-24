import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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
    <section>
      <h3>Approve a repair</h3>
      <p>{findingId ? "Selected finding will be sent to the AI agent." : "Select a finding above."}</p>
      <label>
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        I understand the agent will edit files in a temporary copy. Nothing is pushed.
      </label>
      <button disabled={!findingId || !ack} onClick={onApprove}>Approve repair</button>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </section>
  );
}