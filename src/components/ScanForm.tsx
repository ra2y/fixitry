import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Guide } from "./Guide";

export function ScanForm({ onCreated }: { onCreated: (id: Id<"jobs">) => void }) {
  const createJob = useMutation(api.jobs.create);
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const urlInput = useRef<HTMLInputElement>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const id = await createJob({ repoUrl });
      setRepoUrl("");
      onCreated(id);
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not create the scan job");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="scan-form" onSubmit={onSubmit}>
      <label htmlFor="repo-url">Repository URL</label>
      <div className="scan-form-row">
        <input ref={urlInput} id="repo-url" type="url" value={repoUrl} onChange={(event) => { setRepoUrl(event.target.value); setError(null); }} placeholder="https://github.com/owner/repository" required />
        <button className="primary-button" disabled={busy || !repoUrl}>{busy ? "Starting…" : "Scan repository"}</button>
      </div>
      {error && <Guide title="Scan could not start" message={error} tone="error" actionLabel="Edit repository URL" onAction={() => urlInput.current?.focus()} />}
    </form>
  );
}
