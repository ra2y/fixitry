import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function App() {
  const jobs = useQuery(api.jobs.list);
  const createTest = useMutation(api.jobs.createTest);

  return (
    <main>
      <h1>Fixitry</h1>
      <button onClick={() => createTest({ repoUrl: "https://github.com/example/test" })}>
        Create test job
      </button>
      {jobs === undefined ? (
        <p>Loading…</p>
      ) : (
        <ul>
          {jobs.map((j) => (
            <li key={j._id}>{j.repoUrl}: {j.status}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;