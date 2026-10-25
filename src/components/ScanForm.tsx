import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";

export function ScanForm() {
  const createJob = useMutation(api.jobs.create);
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  type ZapMode = "off" | "baseline" | "active";
  const [zapMode, setZapMode] = useState<ZapMode>("baseline");
  const [confirmActive, setConfirmActive] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createJob({ repoUrl, zapMode });
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
      <select value={zapMode} onChange={(e) => { setZapMode(e.target.value as ZapMode); setConfirmActive(false); }}>
        <option value="off">ZAP: off</option>
        <option value="baseline">ZAP: baseline (watches only, no attacks)</option>
        <option value="active">ZAP: active (sends attack requests)</option>
      </select>
      {zapMode === "active" && (
        <label>
          <input type="checkbox" checked={confirmActive} onChange={(e) => setConfirmActive(e.target.checked)} />
          I own this repository. Attack traffic stays inside an isolated container with no network.
        </label>
      )}
      <button disabled={busy || !repoUrl || (zapMode === "active" && !confirmActive)}>Scan</button>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </form>
  );
}
