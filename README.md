# Fixitry

Fixitry scans one allowlisted GitHub repository, shows findings in a live Convex dashboard, and waits for a person to approve one finding before asking Factory Droid to attempt a repair in a disposable clone.

## Current phase

The implementation reaches Phase 18: the complete local MVP, Docker worker support, and an optional second approval before a branch and pull request. After an approved repair, the worker records Droid activity, rejects edits outside the selected finding's allowed files, stores a patch, runs the demo's Python tests in a virtual environment outside the repository, and scans again with Trivy. It records resolved, remaining, and introduced findings before deleting the clone. A verified repair can wait for a separate push approval; the worker then re-clones, re-applies and re-validates the stored patch, pushes a generated branch, and opens a pull request. The dashboard shows the before/after comparison, test result, agent summary, patch, and pull request link.

Phase 15 hardening: the worker removes `WORKER_SECRET`, `FACTORY_API_KEY`, and `GITHUB_TOKEN` from its own environment after loading config, so no child process (including Droid) inherits them. Convex accepts only one active job at a time. At startup the worker fails any jobs left mid-flight by a previous run and deletes `job-*` temporary directories older than one hour.

## Local setup

1. Run `npm ci` and `npx convex dev` for a personal development deployment.
2. In `.env.local`, set `VITE_CONVEX_URL` to the dev deployment URL. The Convex CLI usually writes this file.
3. In the Convex dev dashboard, set `WORKER_SECRET` and `ALLOWED_REPOSITORIES` (the HTTPS URL of the demo repository).
4. Copy `.env.example` to `.env` if `.env` does not exist. Set `CONVEX_URL` to the same dev URL, `WORKER_SECRET` to the same private value as in Convex, and `DEMO_REPOSITORY_URL` to the allowlisted URL. For repairs, also set `FACTORY_API_KEY` and install the Factory Droid CLI.
5. Install Trivy for scans (this Mac used Trivy 0.76.1). Stop other Fixitry Convex watchers and workers before testing this branch, then start `npm run dev` and `npm run worker` in separate terminals.
6. The demo pins pytest 7.1.2, which fails on Python 3.14 and newer. The worker builds the test venv with `FIXITRY_PYTHON` (default `python3`); set it in `.env` to a Python 3.8–3.13 interpreter, e.g. `FIXITRY_PYTHON=python3.13`.

Keep `.env`, `.env.local`, and real secrets out of Git. Never prefix a secret with `VITE_`. The worker clones the demo repository anonymously, so it must be publicly readable with the current setup.

## Docker worker

`Dockerfile.worker` packages Node 22, Git, Python 3.11, Trivy (pinned and checksum-verified) and the Droid CLI, and runs the worker as the unprivileged `node` user. `.dockerignore` keeps `.env` files, `.git`, and the frontend out of the build context; secrets are supplied only at runtime. `convex/_generated` is git-ignored but copied into the image, so run `npx convex dev` (or `npx convex codegen`) before building from a fresh clone.

```sh
docker build -f Dockerfile.worker -t fixitry-worker --build-arg TRIVY_VERSION=0.76.1 .
docker run --rm --env-file .env -e FIXITRY_PYTHON=python3 \
  --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,size=2g \
  -v fixitry-trivy-cache:/home/node/.cache/trivy \
  fixitry-worker
```

- Values in `.env` must be unquoted; Docker does not strip quotes.
- `-e FIXITRY_PYTHON=python3` overrides the host interpreter name from `.env` with the image's Python.
- Stop the local worker first. On startup the container fails any in-flight jobs (single-worker assumption).
- `/tmp` is a `noexec` tmpfs. The demo's pure-Python dependencies work; a repository needing compiled extensions in its test venv would need `exec` added to the tmpfs options.
- Verify: `docker run --rm fixitry-worker id` prints `uid=1000(node)`, and `docker run --rm fixitry-worker sh -c "which droid && droid --version && trivy --version && git --version && python3 --version"` prints all five tools.

## Checks

- `npm run build`
- `npm run typecheck:worker`
- `npm run lint`
- `npm run test:repair-safety` — checks path validation, changed-file detection, rollback, and patch capture
- `npm run test:compare` — checks resolved, remaining, and introduced finding groups
- `npm run droid:smoke -- <fresh-demo-clone>` — Phase 11 read-only SDK smoke test, requires a valid Factory key and CLI

For a live Phase 13 test, create a new scan and approve a dependency finding in `requirements.txt`. Expect Droid and test events, then a verification scan. In the Convex dev dashboard's Data tab, check the job's `repairAttempts` row for `testsPassed`, counts, and status, and check `findings` for `scanRound: "verification"`. The Phase 14 results panel below the approval panel shows resolved, remaining, and new findings, the test result, the agent summary, and the coloured patch. Set `FIXITRY_KEEP_TMP=1` only for a local inspection, then remove the retained temporary clone and clear the flag.

## Known limitations

1. **No user authentication.** Public Convex functions are callable by anyone who knows the deployment URL. The allowlist and the absence of any push capability limit the impact. Add Convex Auth or another provider before any real use.
2. The worker secret travels as a function argument over HTTPS; it can appear in Convex logs on errors. Rotate it if you share logs.
3. A single worker is assumed: orphan recovery fails every in-flight job when a worker starts. Several workers would need a lease or heartbeat instead.
4. Local development does not sandbox Droid from the host user's files; the Phase 16 Docker worker does, partly.
5. Prompt injection from repository content can influence the agent. Tools are limited and diffs are verified, but a human must still read the patch.
6. Findings depend on Trivy's database freshness. A clean second scan is evidence, not proof.
7. Only a Python/pytest test profile exists.
8. Live branch/PR creation requires a narrowly scoped `GITHUB_TOKEN` and must be tested against a disposable repository before production use.
9. `npm audit` reports zod (<4.6.6) and uuid (<11.1.1) advisories through `@factory/droid-sdk@0.10.0`, the latest release, which pins zod 3 and uuid 9. The only automatic fix downgrades the SDK, so these stay until Factory updates its dependencies.
