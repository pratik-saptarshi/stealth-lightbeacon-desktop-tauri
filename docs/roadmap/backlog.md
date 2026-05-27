# Desktop Completion Ledger And Remediation Backlog

Status was revalidated against the desktop repo and the backend worktree
`/private/tmp/stealth-lightbeacon-phase-0a-0b` on 2026-05-26.

## Original Phase Audit

| Phase | Status | Tracking note |
| --- | --- | --- |
| 0. Contract reset | Complete | Backend now produces the canonical OpenAPI 3.1 contract and the desktop pins it locally with drift checks. |
| 1. Connectivity and evaluation lifecycle | Complete | Desktop config persistence, capability gating, typed errors, retry/recovery, and IPC coverage are in place. |
| 2. Results and artifacts | Complete | Result retrieval, artifact retrieval, and terminal snapshot persistence are implemented and validated against the backend worktree. |
| 3. Recon | Complete | Backend route and desktop transport support exist, and the operator workflow is wired in `src/App.tsx` with unit, browser, and accessibility validation. |
| 4. Hybrid local and remote backend operations | Complete | Local companion lifecycle and remote policy substrate are implemented, and operator-facing auth and compatibility UX is surfaced and verified. |
| 5. History and release hardening | Partial | Contract sync, release validation, and packaging checks are implemented; remaining work is final release packaging validation. |

## Cross-Repo Execution Ledger

| Program phase | Status | Tracking note |
| --- | --- | --- |
| 0A. Contract re-baseline across repos | Complete | Backend-generated OpenAPI and desktop sync gate are in place. |
| 0B. Backend service extraction from CLI | Complete | Backend service layer now exists behind the companion API. |
| 1A. Backend HTTP skeleton, health, capabilities | Complete | Bootstrap routes and structured error behavior are implemented and tested. |
| 1B. Evaluation submission and polling job model | Complete | Backend-owned evaluation IDs and polling state are implemented and consumed by the desktop. |
| 2A. Terminal result contract alignment | Complete | Result route and desktop retrieval flow are implemented and validated. |
| 2B. Artifact descriptor and snapshot alignment | Complete | Artifact descriptors and desktop artifact flow are implemented and validated. |
| 3A. Local companion lifecycle management | Complete | Managed local companion startup, readiness, degraded state, and shutdown are implemented. |
| 3B. Remote auth, version compatibility, transport policy | Complete | Remote HTTPS enforcement, auth token lookup, compatibility substrate, and operator-facing UX are implemented and verified. |
| 4. Recon advisory API alignment | Complete | Backend recon route and desktop transport support exist, and the React workflow is wired and validated with coverage and a11y gates. |
| 5. Release hardening and contract-sync automation | Partial | Cross-repo validation exists; package verification still needs attention. |

## Feature Map

| Feature area | Owning phase | Status | Remaining work |
| --- | --- | --- | --- |
| Repo truth, atlas, and governance docs | R1 | Complete | Refresh the docs, codemaps, and phase ledger so they match the verified code. |
| Recon operator workflow | R2 | Complete | Wire recon into the React shell and preserve the desktop adapter boundary. |
| Remote policy UX | R2 | Complete | Surface unauthorized and compatibility mismatch handling to the operator. |
| Frontend verification | R2 | Complete | Vitest coverage, browser smoke, and accessibility checks keep the 80 percent gate visible. |
| Release packaging and validation | R3 | Partial | Keep the Tauri bundle in the release lane and stabilize readiness and loopback checks. |
| GitHub publication | R4 | Complete | Attach `origin`, push the release line, and publish documented release notes. |

## Merged Remaining Backlog

### Phase R3: Package-Grade Release Validation

- R3-C1: Keep Tauri bundling active in `src-tauri/tauri.conf.json`.
- R3-C2: Make `scripts/release_validate.py` run the Tauri package build and
  record the `.app` artifact evidence.
- R3-C3: Stabilize backend readiness and loopback health checks in the release
  lane so the validation path is deterministic.
- R3-T1: Re-run `npm run validate:release` after the packaging lane is fixed.

Validation gate:
- `npm run validate:release` completes end to end.
- The release lane exercises the Tauri package boundary, not only the web
  bundle.
- Readiness failures are treated as a test or environment issue only after
  evidence proves that assumption.

### Phase R4: GitHub Publication

- R4-C1: Create or attach an `origin` remote for this checkout.
- R4-C2: Push `main` and the release tag.
- R4-F1: Publish a documented GitHub release with operator notes, validation
  evidence, and backend companion dependency notes.

Validation gate:
- `git remote -v` shows a live `origin`.
- The release commit and tag are visible on GitHub.
- The release notes capture the validation matrix and the runtime dependency
  boundary.

## Current Remaining Risk

- Package-grade release validation still needs a stable rerun in the Tauri lane
  before the release boundary can be treated as fully deterministic.
