import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Props = { selectedJobId: Id<"jobs"> | null; onSelect: (id: Id<"jobs">) => void };

export function ScanStatus({ selectedJobId, onSelect }: Props) {
  const jobs = useQuery(api.jobs.list);
  if (jobs === undefined) return <p>Loading…</p>;
  return (
    <ul>
      {jobs.map((job) => (
        <li
          key={job._id}
          onClick={() => onSelect(job._id)}
          style={{ cursor: "pointer", fontWeight: job._id === selectedJobId ? 700 : 400 }}
        >
          {job.repoUrl}: <b>{job.status}</b> {job.error && <em>({job.error})</em>}
        </li>
      ))}
    </ul>
  );
}
