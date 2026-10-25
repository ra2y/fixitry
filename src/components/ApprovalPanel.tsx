import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type Props = { jobId: Id<"jobs">; finding: Doc<"findings"> | null };

export function ApprovalPanel({ jobId, finding }: Props) {
  const job = useQuery(api.jobs.get, { jobId });
  const approve = useMutation(api.jobs.approveFinding);
  const [ack, setAck] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!job || job.status !== "awaiting_approval") return null;

  const needsFiles = finding?.source === "zap";
  const filesOk = !needsFiles || (files.length >= 1 && files.length <= 3);
  const ready = !!finding && ack && filesOk;

  function toggle(path: string) {
    setFiles((cur) => (cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path]));
  }

  async function onApprove() {
    if (!finding) return;
    setError(null);
    try {
      await approve({ jobId, findingId: finding._id, ...(needsFiles ? { allowedFiles: files } : {}) });
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "Approval failed");
    }
  }

  return (
    <section>
      <h3>Approve a repair</h3>
      <p>{finding ? `Selected: ${finding.title}` : "Select a finding above."}</p>

      {needsFiles && (
        <fieldset>
          <legend>This scanner cannot tell which file is at fault. Choose 1 to 3 files the agent may edit:</legend>
          {(job.repoFiles ?? []).map((p) => (
            <label key={p} style={{ display: "block" }}>
              <input type="checkbox" checked={files.includes(p)} onChange={() => toggle(p)} /> {p}
            </label>
          ))}
        </fieldset>
      )}

      <label>
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        I understand the agent will edit files in a temporary copy. Nothing is pushed.
      </label>
      <button disabled={!ready} onClick={onApprove}>Approve repair</button>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </section>
  );
}