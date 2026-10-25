import { useEffect, useState } from "react";

import type { Id } from "../convex/_generated/dataModel";
import { ScanForm } from "./components/ScanForm";
import { ScanStatus } from "./components/ScanStatus";
import { ProgressTimeline } from "./components/ProgressTimeline";
import { FindingsList } from "./components/FindingsList";
import { ApprovalPanel } from "./components/ApprovalPanel";
import { ResultsComparison } from "./components/ResultsComparison";


function App() {
  const [jobId, setJobId] = useState<Id<"jobs"> | null>(null);
  const [findingId, setFindingId] = useState<Id<"findings"> | null>(null)

  useEffect(() => {
    setFindingId(null);
  }, [jobId]);

  return (
    <main>
      <h1>Fixitry</h1>
      <ScanForm />
      <ScanStatus selectedJobId={jobId} onSelect={setJobId}/>
      {jobId && <ProgressTimeline jobId={jobId} />}
      {jobId && <FindingsList jobId={jobId} selectedId={findingId} onSelect={setFindingId} />}
      {jobId && <ApprovalPanel jobId={jobId} findingId={findingId} />}
      {jobId && <ResultsComparison jobId={jobId} />}
    </main>
  );
}

export default App;
