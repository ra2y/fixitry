import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Guide } from "./Guide";

const ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 } as const;
type Severity = Doc<"findings">["severity"];
type Kind = Doc<"findings">["kind"];

const KIND_LABELS: Record<Kind, string> = {
  vulnerability: "Vulnerability",
  secret: "Secret",
  misconfiguration: "Misconfiguration",
  code: "Code",
  dynamic: "Web app (dynamic)",
};

type Props = {
  jobId: Id<"jobs">;
  selectedId: Id<"findings"> | null;
  onSelect: (id: Id<"findings">) => void;
};

function Detail({ f }: { f: Doc<"findings"> }) {
  if (f.kind === "dynamic") {
    return f.httpMethod || f.parameter ? <><strong>{f.httpMethod ?? "GET"}</strong><small>{f.parameter ? `param: ${f.parameter}` : "site-wide"}</small></> : <>—</>;
  }
  if (f.packageName) {
    return <><strong>{f.packageName}</strong><small>{f.installedVersion} → {f.fixedVersion ?? "No fix"}</small></>;
  }
  return <>—</>;
}

export function FindingsList({ jobId, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [kind, setKind] = useState<Kind | "all">("all");
  const all = useQuery(api.findings.listByJob, { jobId });

  if (all === undefined) return <p className="loading-state">Loading findings…</p>;
  const initial = all.filter((f) => f.scanRound === "initial");
  if (initial.length === 0) return <Guide title="No findings yet" message="Findings will appear after the initial scan finishes." />;

  const term = search.trim().toLowerCase();
  const findings = initial
    .filter((f) => severity === "all" || f.severity === severity)
    .filter((f) => kind === "all" || f.kind === kind)
    .filter((f) => !term || [f.title, f.target, f.ruleId, f.packageName ?? "", f.parameter ?? ""].some((value) => value.toLowerCase().includes(term)))
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.title.localeCompare(b.title));
  const kinds = [...new Set(initial.map((f) => f.kind))];

  function clearFilters() { setSearch(""); setSeverity("all"); setKind("all"); }

  return (
    <>
      <div className="finding-filters">
        <label className="search-filter">Search findings<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, file, package, rule, or parameter" /></label>
        <label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as Severity | "all")}><option value="all">All severities</option>{Object.keys(ORDER).map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        <label>Type<select value={kind} onChange={(event) => setKind(event.target.value as Kind | "all")}><option value="all">All types</option>{kinds.map((value) => <option value={value} key={value}>{KIND_LABELS[value]}</option>)}</select></label>
      </div>
      <div className="findings-summary"><span aria-live="polite">{findings.length} of {initial.length} findings</span>{(search || severity !== "all" || kind !== "all") && <button type="button" className="inline-button" onClick={clearFilters}>Clear filters</button>}</div>
      {findings.length === 0 ? <Guide title="No matching findings" message="Try a different search or filter." actionLabel="Clear filters" onAction={clearFilters} /> : <div className="table-scroll"><table className="findings-table">
        <thead><tr><th>Severity</th><th>Source</th><th>Finding</th><th>Location</th><th>Detail</th></tr></thead>
        <tbody>
          {findings.map((f) => (
            <tr key={f._id} className={f._id === selectedId ? "selected" : ""}>
              <td><span className={`severity severity-${f.severity.toLowerCase()}`}>{f.severity}</span></td>
              <td>{f.source ?? "trivy"}</td>
              <td><button type="button" className="finding-select" onClick={() => onSelect(f._id)} aria-pressed={f._id === selectedId}>{f.title}</button><small>{KIND_LABELS[f.kind]}</small></td>
              <td><code>{f.target}{f.startLine ? `:${f.startLine}` : ""}</code></td>
              <td><Detail f={f} /></td>
            </tr>
          ))}
        </tbody>
      </table></div>}
    </>
  );
}
