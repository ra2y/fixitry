import type { Id } from "../../convex/_generated/dataModel";
import { ScanForm } from "./ScanForm";

export function HomePage() {
  return <main className="landing-main">
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <span className="eyebrow">Repository security, with a human in control</span>
        <h1 id="hero-title">Find issues. Review the evidence. Repair with confidence.</h1>
        <p>Fixitry scans an allowlisted GitHub repository, brings security findings into one workspace, and lets you decide what to repair and publish.</p>
        <div className="hero-actions">
          <a className="primary-button button-link" href="#/scans/new">Start a scan <span aria-hidden="true">→</span></a>
          <a className="secondary-button button-link" href="#/features">Explore scanning features</a>
        </div>
      </div>
      <div className="hero-visual" aria-label="Fixitry workflow: scan, review, repair, verify, publish">
        <div className="visual-topline"><span className="visual-dot" /> A clearer path from finding to fix</div>
        <ol className="visual-steps">
          <li><span>01</span><strong>Scan</strong><small>Trivy + Semgrep</small></li>
          <li><span>02</span><strong>Review</strong><small>Choose a finding</small></li>
          <li><span>03</span><strong>Repair</strong><small>Approve the attempt</small></li>
          <li><span>04</span><strong>Verify</strong><small>Compare the results</small></li>
          <li><span>05</span><strong>Publish</strong><small>Approve a pull request</small></li>
        </ol>
      </div>
    </section>
    <section className="landing-section" aria-labelledby="how-title">
      <div className="section-intro"><span className="eyebrow">How it works</span><h2 id="how-title">From repository to reviewable result</h2><p>Each step stays visible in the run workspace, so you can follow the scan and make the approval decisions yourself.</p></div>
      <div className="landing-card-grid">
        <article className="landing-card"><span className="card-number">01 / Connect</span><h3>Pick a repository</h3><p>Start a scan for a GitHub repository on your configured allowlist.</p></article>
        <article className="landing-card"><span className="card-number">02 / Inspect</span><h3>Understand the findings</h3><p>Filter by severity or type, inspect the location and rule, and follow live run activity.</p></article>
        <article className="landing-card"><span className="card-number">03 / Decide</span><h3>Keep control of changes</h3><p>Approve a repair attempt, inspect its verification results, then separately approve publishing.</p></article>
      </div>
    </section>
    <section className="landing-cta"><div><span className="eyebrow">Ready to look closer?</span><h2>Start with a scan.</h2><p>See the current findings for your allowlisted repository.</p></div><a className="primary-button button-link" href="#/scans/new">New scan <span aria-hidden="true">→</span></a></section>
  </main>;
}

export function FeaturesPage() {
  return <main className="landing-main">
    <section className="landing-page-intro"><span className="eyebrow">Current capabilities</span><h1>Know what your scan covers.</h1><p>Fixitry combines repository scanning with a live view of findings. These are the features available in the current local MVP.</p><a className="primary-button button-link" href="#/scans/new">Start a scan <span aria-hidden="true">→</span></a></section>
    <section className="landing-section" aria-labelledby="engines-title"><div className="section-intro"><span className="eyebrow">Scanning engines</span><h2 id="engines-title">Two views of repository risk</h2></div>
      <div className="feature-grid">
        <article className="feature-card"><span className="feature-icon" aria-hidden="true">◇</span><span className="feature-tag">Trivy</span><h3>Dependency and configuration findings</h3><p>Scan the repository for vulnerable packages, exposed secrets, and misconfigurations, with severity and location details.</p></article>
        <article className="feature-card"><span className="feature-icon" aria-hidden="true">⌘</span><span className="feature-tag">Semgrep</span><h3>Source code security rules</h3><p>Run the included security rules against source code and bring matching results into the same findings list.</p></article>
      </div>
    </section>
    <section className="landing-section" aria-labelledby="workspace-title"><div className="section-intro"><span className="eyebrow">In the workspace</span><h2 id="workspace-title">Go from signal to decision</h2></div>
      <div className="landing-card-grid">
        <article className="landing-card"><span className="card-number">01 / Follow</span><h3>Live run progress</h3><p>Track scan status and activity as the worker prepares the repository and records findings.</p></article>
        <article className="landing-card"><span className="card-number">02 / Focus</span><h3>Search and filter</h3><p>Find issues by title, location, package, or rule, and narrow results by severity or type.</p></article>
        <article className="landing-card"><span className="card-number">03 / Compare</span><h3>Verification scan</h3><p>After an approved repair, compare resolved, remaining, and new findings with the initial scan.</p></article>
      </div>
    </section>
    <section className="feature-note"><strong>Before you start</strong><p>Scanning requires a configured Convex deployment, a running worker, and a repository on the allowlist. Repairs and publishing have separate approval steps.</p></section>
  </main>;
}

export function NewScanPage({ onCreated }: { onCreated: (id: Id<"jobs">) => void }) {
  return <main className="landing-main scan-page">
    <section className="landing-page-intro"><span className="eyebrow">New scan</span><h1>See what your repository reveals.</h1><p>Enter an allowlisted public GitHub repository. Fixitry will start a run and take you to its live workspace.</p></section>
    <div className="scan-page-grid">
      <section className="scan-start-card" aria-labelledby="new-scan-title"><div className="card-number">01 / Repository</div><h2 id="new-scan-title">Start a repository scan</h2><p>Use the same repository URL configured in your allowlist.</p><ScanForm onCreated={onCreated} /></section>
      <aside className="scan-help-card" aria-labelledby="scan-next-title"><span className="eyebrow">What happens next</span><h2 id="scan-next-title">A run you can follow</h2><ol><li>The worker prepares a temporary copy of the repository.</li><li>Trivy and Semgrep report their findings.</li><li>Review the results in the run workspace and choose whether to approve a repair.</li></ol><a className="text-link" href="#/features">See all scanning features →</a></aside>
    </div>
  </main>;
}
