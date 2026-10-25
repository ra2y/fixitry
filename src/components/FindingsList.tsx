import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type {
  Doc,
  Id,
} from "../../convex/_generated/dataModel";

const ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  UNKNOWN: 4,
} as const;

type Props = {
  jobId: Id<"jobs">;
  selectedId: Id<"findings"> | null;
  onSelect: (finding: Doc<"findings">) => void;
};

export function FindingsList({
  jobId,
  selectedId,
  onSelect,
}: Props) {
  const all = useQuery(api.findings.listByJob, { jobId });

  if (all === undefined) {
    return <p>Loading findings...</p>;
  }

  const findings = all
    .filter((f) => f.scanRound === "initial")
    .sort(
      (a, b) =>
        ORDER[a.severity] - ORDER[b.severity],
    );

  if (findings.length === 0) {
    return <p>No findings.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Severity</th>
          <th>Source</th>
          <th>Type</th>
          <th>Title</th>
          <th>File</th>
          <th>Detail</th>
        </tr>
      </thead>

      <tbody>
        {findings.map((f) => (
          <tr
            key={f._id}
            onClick={() => onSelect(f)}
            style={{
              cursor: "pointer",
              fontWeight: f._id === selectedId ? 700 : 400,
            }}
          >
            <td>{f.severity}</td>
            <td>{f.source ?? "trivy"}</td>
            <td>{f.kind}</td>
            <td>{f.title}</td>
            <td>{f.target}</td>

            <td>
              {f.kind === "dynamic"
                ? `${f.httpMethod ?? ""} ${
                    f.parameter ?? ""
                  }`.trim()
                : f.packageName
                  ? `${f.packageName} ${
                      f.installedVersion ?? ""
                    } → ${
                      f.fixedVersion ?? "no fix"
                    }`
                  : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}