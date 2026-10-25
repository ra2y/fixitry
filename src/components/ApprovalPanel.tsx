import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Guide } from "./Guide";

type Props = { jobId: Id<"jobs">; findingId: Id<"findings"> | null };

export function ApprovalPanel({ jobId, findingId }: Props) {
  const job = useQuery(api.jobs.get, { jobId });
  const findings = useQuery(api.findings.listByJob, { jobId });
  const approve = useMutation(api.jobs.approveFinding);
  const [ack, setAck] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!job || job.status !== "awaiting_approval") return null;

  const finding = findings?.find((f) => f._id === findingId) ?? null;
  const needsFiles = finding?.source === "zap";
  const repoFiles = job.repoFiles ?? [];
  const filesOk = !needsFiles || (files.length >= 1 && files.length <= 3);
  const ready = !!finding && ack && filesOk && !busy;

  function toggle(path: string) {
    setFiles((cur) => (cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path]));
  }

  async function onApprove() {
    if (!finding) return;
    setError(null);
    setBusy(true);
    try {
      await approve({ jobId, findingId: finding._id, ...(needsFiles ? { allowedFiles: files } : {}) });
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="approval-section">
      <div className="section-kicker">Approval required</div>
      <h3>Approve a repair</h3>
      <p>{finding ? "Fixitry will attempt a repair for this finding in a temporary copy." : "Select a finding to enable this action."}</p>

      {needsFiles && (
        <fieldset className="file-picker">
          <legend>The web scanner cannot tell which file is at fault. Choose 1 to 3 files the agent may edit.</legend>
          {repoFiles.length === 0 ? <p>No editable files were published for this run.</p> : repoFiles.map((p) => {
            const checked = files.includes(p);
            return (
              <label key={p} className="checkbox-label">
                <input type="checkbox" checked={checked} disabled={!checked && files.length >= 3} onChange={() => toggle(p)} />
                <code>{p}</code>
              </label>
            );
          })}
          <small>{files.length} of 3 selected</small>
        </fieldset>
      )}

      <label className="checkbox-label">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>I understand this repair edits a temporary copy. Nothing is pushed.</span>
      </label>
      <button className="primary-button" type="button" disabled={!ready} onClick={onApprove}>{busy ? "Approving…" : "Approve repair"}</button>
      {error && <Guide title="Approval failed" message={error} tone="error" />}
    </section>
  );
}
