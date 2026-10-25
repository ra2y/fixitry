import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Props = { selectedJobId: Id<"jobs"> | null; onSelect: (id: Id<"jobs">) => void };

export function ScanStatus({ selectedJobId, onSelect }: Props) {
  const [expanded, setExpanded] = useState<{ forJob: Id<"jobs"> | null; repo: string | null }>({ forJob: null, repo: null });
  const jobs = useQuery(api.jobs.list);
  if (jobs === undefined) return <p className="sidebar-empty">Loading runs…</p>;
  if (jobs.length === 0) return <p className="sidebar-empty">No runs yet</p>;
  const projects = new Map<string, typeof jobs>();
  for (const job of jobs) {
    const repo = job.repoUrl.replace(/\/+$/, "").toLowerCase();
    const runs = projects.get(repo) ?? [];
    runs.push(job);
    projects.set(repo, runs);
  }
  const selectedRepo = jobs.find((job) => job._id === selectedJobId)?.repoUrl.replace(/\/+$/, "").toLowerCase() ?? null;
  const openRepo = expanded.forJob === selectedJobId ? expanded.repo : selectedRepo;
  return (
    <ul className="project-list">
      {Array.from(projects, ([repo, runs], index) => {
        const isOpen = openRepo === repo;
        const name = runs[0].repoUrl.replace(/^https:\/\/github\.com\//, "").replace(/\/+$/, "");
        const panelId = `project-runs-${index}`;
        return <li className="project-group" key={repo}>
          <button type="button" className={`project-toggle ${isOpen ? "expanded" : ""}`} aria-label={`${name}, ${runs.length} ${runs.length === 1 ? "run" : "runs"}`} aria-expanded={isOpen} aria-controls={isOpen ? panelId : undefined} onClick={() => setExpanded({ forJob: selectedJobId, repo: isOpen ? null : repo })}>
            <span className="project-chevron" aria-hidden="true">›</span>
            <span className="project-name" title={name}>{name}</span>
            <span className="project-count" aria-hidden="true">{runs.length}</span>
          </button>
          {isOpen && <ul className="run-list" id={panelId}>
            {runs.map((job) => <li key={job._id}><button type="button" className={`run-list-button ${job._id === selectedJobId ? "selected" : ""}`} onClick={() => { setExpanded({ forJob: job._id, repo }); onSelect(job._id); }} aria-current={job._id === selectedJobId ? "page" : undefined}>
              <span className="run-list-meta"><span className={`status-dot status-dot-${job.status}`} />{job.status.replaceAll("_", " ")}</span>
              <span className="run-list-details"><time dateTime={new Date(job._creationTime).toISOString()}>{new Date(job._creationTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>{job.commitSha && <code>{job.commitSha.slice(0, 7)}</code>}</span>
            </button></li>)}
          </ul>}
        </li>;
      })}
    </ul>
  );
}
