# Fixitry

Fixitry scans one allowlisted GitHub repository, shows findings in a live Convex dashboard, and waits for a person to approve one finding before asking Factory Droid to attempt a repair in a disposable clone.

## Current phase

The implementation reaches Phase 13. After an approved repair, the worker records Droid activity, rejects edits outside the selected finding's allowed files, stores a patch, runs the demo's Python tests in a virtual environment outside the repository, and scans again with Trivy. It records resolved, remaining, and introduced findings before deleting the clone. An attempt succeeds only when the tests pass and the selected finding is gone.

## Local setup

1. Run `npm ci` and `npx convex dev` for a personal development deployment.
2. In `.env.local`, set `VITE_CONVEX_URL` to the dev deployment URL. The Convex CLI usually writes this file.
3. In the Convex dev dashboard, set `WORKER_SECRET` and `ALLOWED_REPOSITORIES` (the HTTPS URL of the demo repository).
4. Copy `.env.example` to `.env` if `.env` does not exist. Set `CONVEX_URL` to the same dev URL, `WORKER_SECRET` to the same private value as in Convex, and `DEMO_REPOSITORY_URL` to the allowlisted URL. For repairs, also set `FACTORY_API_KEY` and install the Factory Droid CLI.
5. Install Trivy for scans (this Mac used Trivy 0.76.1). Stop other Fixitry Convex watchers and workers before testing this branch, then start `npm run dev` and `npm run worker` in separate terminals.
6. The demo pins pytest 7.1.2, which fails on Python 3.14 and newer. The worker builds the test venv with `FIXITRY_PYTHON` (default `python3`); set it in `.env` to a Python 3.8–3.13 interpreter, e.g. `FIXITRY_PYTHON=python3.13`.

Keep `.env`, `.env.local`, and real secrets out of Git. Never prefix a secret with `VITE_`. The worker clones the demo repository anonymously, so it must be publicly readable with the current setup.

## Checks

- `npm run build`
- `npm run typecheck:worker`
- `npm run lint`
- `npm run test:repair-safety` — checks path validation, changed-file detection, rollback, and patch capture
- `npm run test:compare` — checks resolved, remaining, and introduced finding groups
- `npm run droid:smoke -- <fresh-demo-clone>` — Phase 11 read-only SDK smoke test, requires a valid Factory key and CLI

For a live Phase 13 test, create a new scan and approve a dependency finding in `requirements.txt`. Expect Droid and test events, then a verification scan. In the Convex dev dashboard's Data tab, check the job's `repairAttempts` row for `testsPassed`, counts, and status, and check `findings` for `scanRound: "verification"`. The results UI belongs to Phase 14. Set `FIXITRY_KEEP_TMP=1` only for a local inspection, then remove the retained temporary clone and clear the flag.

## Limitations

- No authentication for the dashboard yet; use only the private development deployment and demo repository.
- The before/after results UI is planned for Phase 14; Phase 13 results are stored in Convex.
- Local Droid runs with the host user's filesystem access. The Phase 16 container is the planned filesystem boundary.
- No branch push or pull request is performed by the worker.
