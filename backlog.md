# Desktop Completion Ledger And Remediation Backlog

Status was revalidated against the desktop repo and the backend worktree
`/private/tmp/stealth-lightbeacon-phase-0a-0b` on 2026-05-26.

## Original Phase Audit

| Phase | Status | Tracking note |
| --- | --- | --- |
| 0. Contract reset | Complete | Backend now produces the canonical OpenAPI 3.1 contract and the desktop pins it locally with drift checks. |
| 1. Connectivity and evaluation lifecycle | Complete | Desktop config persistence, capability gating, typed errors, retry/recovery, and IPC coverage are in place. |
| 2. Results and artifacts | Complete | Result retrieval, artifact retrieval, and terminal snapshot persistence are implemented and validated against the backend worktree. |
| 3. Recon | Partial | Backend route and desktop transport support exist, but the operator workflow is not yet wired in `src/App.tsx`. |
| 4. Hybrid local and remote backend operations | Partial | Local companion lifecycle and remote policy substrate are implemented, but operator-facing auth and compatibility UX is still thin. |
| 5. History and release hardening | Partial | Contract sync, release validation, and packaging checks are implemented; remaining work includes publication plumbing and final release packaging validation. |

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
| 3B. Remote auth, version compatibility, transport policy | Partial | Remote HTTPS enforcement, auth token lookup, and compatibility substrate are implemented, but operator-facing UX completion remains. |
| 4. Recon advisory API alignment | Partial | Backend recon route and desktop transport support exist, but React UI wiring is still missing. |
| 5. Release hardening and contract-sync automation | Partial | Cross-repo validation exists; publication automation, package verification, and repo-truth docs still need attention. |

## Adversarial Review Findings

| ID | Severity | Bucket | Summary | Action |
| --- | --- | --- | --- | --- |
| R3-F01 | HIGH | Validation gap | Repo truth docs and codemaps still describe completed phases as missing or blocked. | Rewrite the completion ledger, repo maps, and architecture docs to match verified code. |
| R3-F02 | HIGH | Capability gap | Release validation stopped at the frontend bundle and did not exercise the Tauri package boundary. | Add `npm run tauri:build` to the release lane and validate the macOS `.app` bundle path. |
| R3-F03 | HIGH | Capability gap | This checkout has no Git remote configured, so GitHub publication is not possible from current state. | Create or attach `origin`, push `main`, and publish a documented GitHub release. |
| R3-F04 | MEDIUM | Feature gap | Governance docs for contribution, security reporting, and bill of materials were missing. | Add the missing docs and link them from the root README. |
| R3-F05 | MEDIUM | Validation gap | AGENTS and codemap guidance were stale and would misdirect future agents. | Refresh root and folder codemaps plus `AGENTS.md`. |
| R3-F06 | MEDIUM | Feature gap | Recon transport exists, but the operator workflow is absent from `src/App.tsx`. | Add React recon workflow and integration coverage. |
| R3-F07 | MEDIUM | Feature gap | Remote auth and compatibility handling are mostly transport-level and not yet surfaced as explicit operator UX. | Add operator-visible unauthorized and version-mismatch messaging plus tests. |

## Merged Remaining Backlog

### Phase R1: Repo Truth And Guidance

- R1-F1: Refresh `README.md`, `architecture.md`, `backlog.md`,
  `implementation-roadmap.md`, `plan-review-traceability.md`, `AGENTS.md`, and
  codemap files to reflect the verified implementation state.
- R1-F2: Add `contributing.md`, `security-policy.md`, and
  `bill-of-materials.md`.
- R1-T1: Re-run contract, UI, and Rust validation after the doc refresh.

### Phase R2: Recon And Remote Policy UX

- R2-F1: Add operator-facing recon workflow in `src/App.tsx`.
- R2-F2: Add explicit unauthorized and compatibility-mismatch UX in `src/App.tsx`.
- R2-T1: Add Vitest coverage for recon and remote policy UX.

### Phase R3: Package-Grade Release Validation

- R3-C1: Keep Tauri bundling active in `src-tauri/tauri.conf.json`.
- R3-C2: Make `scripts/release_validate.py` run the Tauri package build.
- R3-T1: Re-run `npm run validate:release`.

### Phase R4: GitHub Publication

- R4-C1: Create or attach an `origin` remote for this checkout.
- R4-C2: Push `main` and any release tag.
- R4-F1: Publish a documented GitHub release with operator notes, validation
  evidence, and backend companion dependency notes.

## Current Remaining Risk

- Recon UI and remote-policy UX still need implementation work in the React
  shell.
- GitHub publication remains blocked until a remote repository exists or is
  attached to this checkout.
