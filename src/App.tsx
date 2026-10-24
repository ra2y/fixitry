import { useState } from "react";
import type { Id } from "../convex/_generated/dataModel";
import { ScanForm } from "./components/ScanForm";
import { ScanStatus } from "./components/ScanStatus";

function App() {
  const [jobId, setJobId] = useState<Id<"jobs"> | null>(null);
  return (
    <main>
      <h1>Fixitry</h1>
      <ScanForm />
      <ScanStatus selectedJobId={jobId} onSelect={setJobId} />
    </main>
  );
}

export default App;
