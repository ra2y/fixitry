import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Guide } from "./Guide";

type ZapMode = "off" | "baseline" | "active";

export function ScanForm({ onCreated }: { onCreated: (id: Id<"jobs">) => void }) {
  const createJob = useMutation(api.jobs.create);
  const [repoUrl, setRepoUrl] = useState("");
  const [zapMode, setZapMode] = useState<ZapMode>("baseline");
  const [confirmActive, setConfirmActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const urlInput = useRef<HTMLInputElement>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const id = await createJob({ repoUrl, zapMode });
      setRepoUrl("");
      setConfirmActive(false);
      onCreated(id);
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not create the scan job");
    } finally {
      setBusy(false);
    }
  }

  const blocked = busy || !repoUrl || (zapMode === "active" && !confirmActive);

  return (
    <form className="scan-form" onSubmit={onSubmit}>
      <label htmlFor="repo-url">Repository URL</label>
      <div className="scan-form-row">
        <input ref={urlInput} id="repo-url" type="url" value={repoUrl} onChange={(event) => { setRepoUrl(event.target.value); setError(null); }} placeholder="https://github.com/owner/repository" required />
        <button className="primary-button" disabled={blocked}>{busy ? "Starting…" : "Scan repository"}</button>
      </div>
      <label htmlFor="zap-mode">Web app scan (ZAP)</label>
      <select id="zap-mode" value={zapMode} onChange={(event) => { setZapMode(event.target.value as ZapMode); setConfirmActive(false); }}>
        <option value="off">Off</option>
        <option value="baseline">Baseline: watches only, no attacks</option>
        <option value="active">Active: sends attack requests</option>
      </select>
      {zapMode === "active" && (
        <label className="checkbox-label">
          <input type="checkbox" checked={confirmActive} onChange={(event) => setConfirmActive(event.target.checked)} />
          <span>I own this repository. Attack traffic stays inside an isolated container with no network.</span>
        </label>
      )}
      {error && <Guide title="Scan could not start" message={error} tone="error" actionLabel="Edit repository URL" onAction={() => urlInput.current?.focus()} />}
    </form>
  );
}
