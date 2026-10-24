import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'

type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

function SetupNotice() {
  return (
    <main className="shell">
      <p className="eyebrow">Phase 3 · Convex</p>
      <h1>Fixitry</h1>
      <p className="lede">Connect a Convex deployment to start creating live jobs.</p>
      <div className="notice">
        Set <code>VITE_CONVEX_URL</code> in <code>.env.local</code>, then restart the Vite server.
      </div>
    </main>
  )
}

function statusLabel(status: JobStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function Dashboard() {
  const jobs = useQuery(api.jobs.list)
  const createJob = useMutation(api.jobs.create)
  const [repositoryUrl, setRepositoryUrl] = useState('https://github.com/YOUR-USER/fixitry-vulnerable-demo')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await createJob({ repositoryUrl })
      setRepositoryUrl('https://github.com/YOUR-USER/fixitry-vulnerable-demo')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create job.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Human-approved security remediation</p>
          <h1>Fixitry</h1>
          <p className="lede">Queue a repository scan and watch the job state update live.</p>
        </div>
        <span className="connection-pill">Convex connected</span>
      </header>

      <section className="card">
        <h2>Start a scan</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="repository-url">Authorized repository URL</label>
          <div className="form-row">
            <input
              id="repository-url"
              type="url"
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
              placeholder="https://github.com/owner/repository"
              required
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create job'}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Live query</p>
            <h2>Jobs</h2>
          </div>
          <span className="job-count">{jobs?.length ?? 0}</span>
        </div>
        {jobs === undefined ? (
          <p className="muted">Loading jobs…</p>
        ) : jobs.length === 0 ? (
          <p className="muted">No jobs yet. Create the first scan above.</p>
        ) : (
          <ul className="job-list">
            {jobs.map((job) => (
              <li key={job._id} className="job-row">
                <div>
                  <strong>{job.repositoryUrl}</strong>
                  <small>{new Date(job._creationTime).toLocaleString()}</small>
                </div>
                <span className={`status status-${job.status}`}>{statusLabel(job.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function App() {
  return import.meta.env.VITE_CONVEX_URL ? <Dashboard /> : <SetupNotice />
}

export default App
