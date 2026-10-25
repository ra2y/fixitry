import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { compareFindings } from "../../shared/compare";

function Patch({ text }: { text: string }) {
  return (
    <pre style={{ overflowX: "auto", background: "#020617", padding: "1rem" }}>
      {text.split("\n").map((line, i) => (
        <div key={i} style={{ color: line.startsWith("+") && !line.startsWith("+++") ? "#4ade80"
                              : line.startsWith("-") && !line.startsWith("---") ? "#f87171" : undefined }}>
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

export function ResultsComparison({ jobId }: { jobId: Id<"jobs"> }) {
  const findings = useQuery(api.findings.listByJob, { jobId });
  const attempts = useQuery(api.repairAttempts.listByJob, { jobId });
  if (!findings || !attempts || attempts.length === 0) return null;

  const attempt = attempts[attempts.length - 1];
  if (attempt.status === "running") return <p>Repair in progress…</p>;

  const before = findings.filter((f) => f.scanRound === "initial");
  const after = findings.filter((f) => f.scanRound === "verification");
  const { resolved, remaining, introduced } = compareFindings(before, after);

  return (
    <section>
      <h2>Result: {attempt.status === "succeeded" ? "Repair verified" : "Repair not verified"}</h2>
      {attempt.error && <p style={{ color: "#fbbf24" }}>{attempt.error}</p>}
      <p>Tests: <b>{attempt.testsPassed === undefined ? "not run" : attempt.testsPassed ? "passed" : "FAILED"}</b></p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <div><h3>Resolved ({resolved.length})</h3><ul>{resolved.map((f) => <li key={f._id}>{f.title}</li>)}</ul></div>
        <div><h3>Still present ({remaining.length})</h3><ul>{remaining.map((f) => <li key={f._id}>{f.title}</li>)}</ul></div>
        <div><h3>New ({introduced.length})</h3><ul>{introduced.map((f) => <li key={f._id}>{f.title}</li>)}</ul></div>
      </div>

      {attempt.summary && (<><h3>What the agent says it did</h3><p style={{ whiteSpace: "pre-wrap" }}>{attempt.summary}</p></>)}
      {attempt.patch && (<><h3>Code changes {attempt.patchTruncated && "(truncated)"}</h3><Patch text={attempt.patch} /></>)}
      {attempt.testOutput && (<details><summary>Test output</summary><pre>{attempt.testOutput}</pre></details>)}
    </section>
  );
}
