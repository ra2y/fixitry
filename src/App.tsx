import { useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { ApprovalPanel } from "./components/ApprovalPanel";
import { FindingsList } from "./components/FindingsList";
import { Guide } from "./components/Guide";
import { ProgressTimeline } from "./components/ProgressTimeline";
import { PushApprovalPanel } from "./components/PushApprovalPanel";
import { ResultsComparison } from "./components/ResultsComparison";
import { ScanForm } from "./components/ScanForm";
import { ScanStatus } from "./components/ScanStatus";

type View = "findings" | "activity" | "results";
const steps = ["Scan", "Review", "Repair", "Verify", "Publish"];
type StepState = "done" | "active" | "waiting" | "failed" | "skipped" | "upcoming";
const statusLabels: Record<Doc<"jobs">["status"], string> = {
  pending: "Queued", cloning: "Preparing repository", scanning: "Scanning",
  awaiting_approval: "Needs repair approval", approved: "Repair queued",
  repairing: "Repairing", testing: "Running tests", verifying: "Verifying",
  awaiting_push_approval: "Needs push approval", pushing: "Opening pull request",
  completed: "Completed", failed: "Failed",
};

function currentStep(job: Doc<"jobs">) {
  if (["pending", "cloning", "scanning"].includes(job.status)) return 0;
  if (job.status === "awaiting_approval") return 1;
  if (["approved", "repairing", "testing"].includes(job.status)) return 2;
  if (job.status === "verifying") return 3;
  return 4;
}

function RunSteps({ job }: { job: Doc<"jobs"> }) {
  const attempts = useQuery(api.repairAttempts.listByJob, job.selectedFindingId ? { jobId: job._id } : "skip");
  const attempt = attempts?.[attempts.length - 1];
  let states: StepState[];
  if (job.status === "completed") {
    if (!job.selectedFindingId) states = ["done", "skipped", "skipped", "skipped", "skipped"];
    else if (job.pullRequestUrl) states = ["done", "done", "done", "done", "done"];
    else if (attempt?.status === "failed") states = ["done", "done", "done", "failed", "skipped"];
    else states = ["done", "done", "done", attempt?.status === "succeeded" ? "done" : "upcoming", "skipped"];
  } else if (job.status === "failed") {
    const failedAt = job.branchName ? 4 : attempt?.status === "failed" ? 3 : job.selectedFindingId ? 2 : 0;
    states = steps.map((_, index) => index < failedAt ? "done" : index === failedAt ? "failed" : "skipped");
  } else {
    const active = currentStep(job);
    const waiting = job.status === "awaiting_approval" || job.status === "awaiting_push_approval";
    states = steps.map((_, index) => index < active ? "done" : index === active ? waiting ? "waiting" : "active" : "upcoming");
  }
  const descriptions: Record<StepState, string> = { done: "Complete", active: "In progress", waiting: "Approval needed", failed: "Failed", skipped: "Not needed", upcoming: "Upcoming" };
  return <ol className="run-steps" aria-label="Run progress">
    {steps.map((step, index) => <li key={step} className={`run-step step-${states[index]}`} aria-current={["active", "waiting", "failed"].includes(states[index]) ? "step" : undefined}>
      <span className="step-number">{states[index] === "done" ? "✓" : states[index] === "failed" ? "!" : index + 1}</span><span className="step-copy"><strong>{step}</strong><small>{index === 4 && ["upcoming", "skipped"].includes(states[index]) ? "Optional" : descriptions[states[index]]}</small></span>
    </li>)}
  </ol>;
}

function FindingDetail({ jobId, findingId }: { jobId: Id<"jobs">; findingId: Id<"findings"> | null }) {
  const findings = useQuery(api.findings.listByJob, { jobId });
  const finding = findings?.find((item) => item._id === findingId);
  if (!finding) return <Guide title="Select a finding" message="Choose a row to inspect the evidence and available repair action." />;
  return <div className="finding-detail">
    <div className="section-kicker">Finding details</div>
    <h3>{finding.title}</h3>
    <span className={`severity severity-${finding.severity.toLowerCase()}`}>{finding.severity}</span>
    <dl className="detail-list">
      <div><dt>Type</dt><dd>{finding.kind}</dd></div>
      <div><dt>Rule</dt><dd>{finding.ruleId}</dd></div>
      <div><dt>Location</dt><dd><code>{finding.target}{finding.startLine ? `:${finding.startLine}` : ""}</code></dd></div>
      {finding.packageName && <div><dt>Package</dt><dd>{finding.packageName} {finding.installedVersion}</dd></div>}
      {finding.fixedVersion && <div><dt>Fixed in</dt><dd>{finding.fixedVersion}</dd></div>}
    </dl>
    <p className="finding-description">{finding.description}</p>
  </div>;
}

function App() {
  const scanDialog = useRef<HTMLDialogElement>(null);
  const [jobId, setJobId] = useState<Id<"jobs"> | null>(null);
  const [findingId, setFindingId] = useState<Id<"findings"> | null>(null);
  const [view, setView] = useState<View>("findings");
  const jobs = useQuery(api.jobs.list);
  const activeJobId = jobId ?? jobs?.[0]?._id ?? null;
  const job = useQuery(api.jobs.get, activeJobId ? { jobId: activeJobId } : "skip");

  function selectJob(id: Id<"jobs">) {
    setJobId(id);
    setFindingId(null);
    setView("findings");
  }

  return <div className="app-shell">
    <header className="global-header">
      <img className="brand-mark" src="/fixitry-mark.svg" alt="" /><span className="brand-name">Fixitry</span>
      <span className="header-context">Repository security</span>
    </header>
    <div className="workspace">
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="sidebar-title">Recent runs</div>
        <ScanStatus selectedJobId={activeJobId} onSelect={selectJob} />
      </aside>
      <main className="main-content">
        <div className="page-heading">
          <div><h1>Security overview</h1><p>Review findings and verify repairs before publishing.</p></div>
          {activeJobId && <button className="primary-button" type="button" onClick={() => scanDialog.current?.showModal()}>New scan</button>}
        </div>
        {!activeJobId && <section className="scan-section" aria-labelledby="scan-title"><h2 id="scan-title">Start a scan</h2><p>Scan an allowlisted GitHub repository.</p><ScanForm onCreated={selectJob} /></section>}
        {!activeJobId ? <section className="empty-workspace"><Guide title="Ready when you are" message="Start a scan or choose a recent run to review its findings and progress." /></section>
          : job === undefined ? <div className="loading-state" role="status">Loading run…</div>
          : job === null ? <Guide title="Run unavailable" message="This run could not be found." tone="error" actionLabel="Start a new scan" onAction={() => scanDialog.current?.showModal()} />
          : <section className="run-workspace" aria-label="Selected run">
            <div className="run-heading"><div><div className="section-kicker">Selected run</div><h2>{job.repoUrl.replace(/^https:\/\/github\.com\//, "")}</h2><p className="run-meta">Started {new Date(job._creationTime).toLocaleString()} {job.commitSha && <>· Commit <code>{job.commitSha.slice(0, 8)}</code></>}</p></div><span className={`status-badge status-${job.status}`}>{statusLabels[job.status]}</span></div>
            <RunSteps job={job} />
            {job.error && <Guide title="This run needs attention" message={job.error} tone="error" actionLabel="View activity" onAction={() => setView("activity")} />}
            {job.status === "awaiting_approval" && <div className="notice-banner">Select a finding and approve a repair to continue. No code is pushed at this stage.</div>}
            {job.status === "awaiting_push_approval" && <div className="notice-banner">Repair verified. Review the patch before the separate push approval. <button className="inline-button" type="button" onClick={() => setView("results")}>View results</button></div>}
            <div className="view-tabs" role="tablist" aria-label="Run details">
              {(["findings", "activity", "results"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={view === tab} className={view === tab ? "tab active" : "tab"} onClick={() => setView(tab)}>{tab === "findings" ? "Findings" : tab === "activity" ? "Activity" : "Results & publish"}</button>)}
            </div>
            {view === "findings" && <div className="findings-layout" role="tabpanel">
              <section className="content-panel findings-panel" aria-labelledby="findings-title"><div className="panel-heading"><h3 id="findings-title">Findings</h3><span>Initial scan</span></div><FindingsList jobId={activeJobId} selectedId={findingId} onSelect={setFindingId} /></section>
              <aside className="content-panel detail-panel" aria-label="Finding details and approval"><FindingDetail jobId={activeJobId} findingId={findingId} /><ApprovalPanel key={`${activeJobId}:${findingId}`} jobId={activeJobId} findingId={findingId} /></aside>
            </div>}
            {view === "activity" && <section className="content-panel tab-panel" role="tabpanel"><div className="panel-heading"><h3>Run activity</h3><span>Live updates</span></div><ProgressTimeline jobId={activeJobId} /></section>}
            {view === "results" && <div className="results-layout" role="tabpanel"><ResultsComparison jobId={activeJobId} /><PushApprovalPanel key={activeJobId} jobId={activeJobId} /></div>}
          </section>}
      </main>
    </div>
    {activeJobId && <dialog ref={scanDialog} className="scan-dialog" aria-labelledby="scan-dialog-title"><div className="dialog-heading"><div><h2 id="scan-dialog-title">New scan</h2><p>Enter an allowlisted GitHub repository.</p></div><button type="button" className="dialog-close" aria-label="Close" onClick={() => scanDialog.current?.close()}>×</button></div><ScanForm onCreated={(id) => { selectJob(id); scanDialog.current?.close(); }} /></dialog>}
  </div>;
}

export default App;
