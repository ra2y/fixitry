import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function ProgressTimeline({ jobId }: { jobId: Id<"jobs"> }) {
  const events = useQuery(api.events.listByJob, { jobId });
  if (events === undefined) return <p>Loading events…</p>;
  return (
    <ol>
      {events.map((e) => (
        <li key={e._id} style={{ color: e.level === "error" ? "#f87171" : e.level === "warn" ? "#fbbf24" : undefined }}>
          <code>[{e.source}]</code> {e.message}
        </li>
      ))}
    </ol>
  );
}