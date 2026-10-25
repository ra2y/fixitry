import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Guide } from "./Guide";

export function ProgressTimeline({ jobId }: { jobId: Id<"jobs"> }) {
  const events = useQuery(api.events.listByJob, { jobId });
  if (events === undefined) return <p className="loading-state">Loading activity…</p>;
  if (events.length === 0) return <Guide title="No activity yet" message="Worker events will appear here as the run progresses." />;
  return (
    <ol className="activity-list">
      {events.map((e) => (
        <li key={e._id} className={`activity-item activity-${e.level}`}>
          <span className="activity-marker" />
          <div><div className="activity-heading"><strong>{e.source}</strong><time>{new Date(e._creationTime).toLocaleTimeString()}</time></div><p>{e.message}</p></div>
        </li>
      ))}
    </ol>
  );
}
