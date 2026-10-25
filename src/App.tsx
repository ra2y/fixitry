import { useEffect, useState } from "react";

import type { Doc, Id } from "../convex/_generated/dataModel";
import { ScanForm } from "./components/ScanForm";
import { ScanStatus } from "./components/ScanStatus";
import { ProgressTimeline } from "./components/ProgressTimeline";
import { FindingsList } from "./components/FindingsList";
import { ApprovalPanel } from "./components/ApprovalPanel";
import { ResultsComparison } from "./components/ResultsComparison";
import { PushApprovalPanel } from "./components/PushApprovalPanel";


function App() {
  const [jobId, setJobId] = useState<Id<"jobs"> | null>(null);
  const [finding, setFinding] = useState<Doc<"findings"> | null>(null);


  useEffect(() => {
    setFinding(null);
  }, [jobId]);

  return (
    <main>
      <h1>Fixitry</h1>
      <ScanForm />
      <ScanStatus selectedJobId={jobId} onSelect={setJobId}/>
      {jobId && <ProgressTimeline jobId={jobId} />}
      {jobId && <FindingsList jobId={jobId} selectedId={finding?._id ?? null} onSelect={setFinding} />}
      {jobId && <ApprovalPanel key={finding?._id ?? "none"} jobId={jobId} finding={finding} />}
      {jobId && <PushApprovalPanel jobId={jobId} />}
      {jobId && <ResultsComparison jobId={jobId} />}
    </main>
  );
}

export default App;
