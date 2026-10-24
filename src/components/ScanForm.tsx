import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";

export function ScanForm() {
  const createJob = useMutation(api.jobs.create);
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createJob({ repoUrl });
      setRepoUrl("");
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not create the scan job");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input
        value={repoUrl}
        onChange={(event) => setRepoUrl(event.target.value)}
        placeholder="https://github.com/you/fixitry-vulnerable-demo"
        style={{ width: "28rem" }}
      />
      <button disabled={busy || !repoUrl}>Scan</button>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </form>
  );
}
