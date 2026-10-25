import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { compareFindings } from "../../shared/compare";
import { Guide } from "./Guide";

function Patch({ text }: { text: string }) {
  return (
    <pre className="code-patch">
      {text.split("\n").map((line, i) => (
        <div key={i} className={line.startsWith("+") && !line.startsWith("+++") ? "patch-added" : line.startsWith("-") && !line.startsWith("---") ? "patch-removed" : ""}>
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

export function ResultsComparison({ jobId }: { jobId: Id<"jobs"> }) {
  const findings = useQuery(api.findings.listByJob, { jobId });
  const attempts = useQuery(api.repairAttempts.listByJob, { jobId });
  if (!findings || !attempts) return <p className="loading-state">Loading results…</p>;
  if (attempts.length === 0) return <Guide title="No repair results" message="This run has no repair attempt to compare yet." />;

  const attempt = attempts[attempts.length - 1];
  if (attempt.status === "running") return <div className="content-panel"><p>Repair in progress…</p></div>;

  const before = findings.filter((f) => f.scanRound === "initial");
  const after = findings.filter((f) => f.scanRound === "verification");
  const { resolved, remaining, introduced } = compareFindings(before, after);

  return (
    <section className="content-panel results-panel">
      <div className="section-kicker">Verification</div>
      <div className="result-header"><h3>{attempt.status === "succeeded" ? "Repair verified" : "Repair not verified"}</h3><span className={`status-badge ${attempt.testsPassed ? "status-completed" : "status-failed"}`}>Tests: {attempt.testsPassed === undefined ? "not run" : attempt.testsPassed ? "passed" : "failed"}</span></div>
      {attempt.error && <p className="result-error">{attempt.error}</p>}
      <div className="result-metrics">
        <div><strong>{resolved.length}</strong><span>Resolved</span></div>
        <div><strong>{remaining.length}</strong><span>Still present</span></div>
        <div><strong>{introduced.length}</strong><span>New</span></div>
      </div>
      <div className="result-groups">
        <div><h4>Resolved</h4><ul>{resolved.map((f) => <li key={f._id}>{f.title}</li>)}</ul>{resolved.length === 0 && <p>None</p>}</div>
        <div><h4>Still present</h4><ul>{remaining.map((f) => <li key={f._id}>{f.title}</li>)}</ul>{remaining.length === 0 && <p>None</p>}</div>
        <div><h4>New</h4><ul>{introduced.map((f) => <li key={f._id}>{f.title}</li>)}</ul>{introduced.length === 0 && <p>None</p>}</div>
      </div>
      {attempt.summary && <div className="result-section"><h4>Repair summary</h4><p className="pre-wrap">{attempt.summary}</p></div>}
      {attempt.patch && <div className="result-section"><h4>Code changes {attempt.patchTruncated && "(truncated)"}</h4><Patch text={attempt.patch} /></div>}
      {attempt.testOutput && <details className="result-section"><summary>Test output</summary><pre className="plain-patch">{attempt.testOutput}</pre></details>}
    </section>
  );
}
