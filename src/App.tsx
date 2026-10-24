import { useState } from "react";
import type { Id } from "../convex/_generated/dataModel";
import { ScanForm } from "./components/ScanForm";
import { ScanStatus } from "./components/ScanStatus";
import { ProgressTimeline } from "./components/ProgressTimeline";
import { FindingsList } from "./components/FindingsList";

function App() {
  const [jobId, setJobId] = useState<Id<"jobs"> | null>(null);
  return (
    <main>
      <h1>Fixitry</h1>
      <ScanForm />
      <ScanStatus selectedJobId={jobId} onSelect={setJobId}/>
      {jobId && <ProgressTimeline jobId={jobId} />}
      {jobId && <FindingsList jobId={jobId} />}
    </main>
  );
}

export default App;
