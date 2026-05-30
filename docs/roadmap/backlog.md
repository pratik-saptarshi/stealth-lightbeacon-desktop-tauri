# Desktop Completion Ledger And Remediation Backlog

Status was revalidated against the desktop repo and the backend worktree
`/private/tmp/stealth-lightbeacon-phase-0a-0b` on 2026-05-26.

## Original Phase Audit

| Phase | Status | Tracking note |
| --- | --- | --- |
| 0. Contract reset | Complete | Backend now produces the canonical OpenAPI 3.1 contract and the desktop pins it locally with drift checks. |
| 1. Connectivity and evaluation lifecycle | Complete | Desktop config persistence, capability gating, typed errors, retry/recovery, and IPC coverage are in place. |
| 2. Results and artifacts | Complete | Result retrieval, artifact retrieval, and terminal snapshot persistence are implemented and validated against the backend worktree. |
| 3. Recon | Complete | Backend route, desktop transport support, and operator workflow are wired in `src/App.tsx`. |
| 4. Hybrid local and remote backend operations | Complete | Local companion lifecycle plus remote auth and compatibility UX are implemented. |
| 5. History and release hardening | Partial | Contract sync, release validation, and packaging checks are implemented; remaining work is package-grade release validation hardening. |

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
| 3B. Remote auth, version compatibility, transport policy | Complete | Remote HTTPS enforcement, auth token lookup, and compatibility UX are implemented. |
| 4. Recon advisory API alignment | Complete | Backend recon route and desktop transport support are wired into the React shell. |
| 5. Release hardening and contract-sync automation | Partial | Cross-repo validation exists; package-grade release validation still needs deterministic readiness hardening. |

## Feature Map

| Feature area | Owning phase | Status | Remaining work |
| --- | --- | --- | --- |
| Repo truth, atlas, and governance docs | R1 | Complete | Docs, codemaps, and phase ledger now match the verified code. |
| Recon operator workflow | R2 | Complete | Recon is wired into the React shell and validated. |
| Remote policy UX | R2 | Complete | Unauthorized and compatibility handling are surfaced to the operator. |
| Frontend verification | R2 | Partial | Vitest coverage, browser smoke, and accessibility checks are in place; branch coverage follow-up remains. |
| Release packaging and validation | R3 | Partial | Keep the Tauri bundle in the release lane and stabilize readiness and loopback checks. |
| GitHub publication | R4 | Complete | Release tags and the GitHub release workflow are in place. |

## Merged Remaining Backlog

### Phase R1: Repo Truth, Atlas, and Governance

- No open items. Docs, codemaps, and ledger now match the verified code.

Validation gate:
- `README.md` and `readme.md` agree on the repo purpose and current phase
  status.
- `./backlog.md` and `./implementation-roadmap.md` agree on the partial-vs-complete
  ledger.
- `codemap.md` entries point to the correct folder maps.

### Phase R2: Frontend Verification Follow-Up

- R2-T1: Raise the shell coverage gate to the agreed threshold for the current
  surface mix and keep the Playwright and accessibility suite green.

Validation gate:
- `npm run test:coverage` passes.
- `npm run test:e2e` passes.
- The shell stays within the compact 800 x 600 scroll budget.

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

- No open items. Release tags and the GitHub release workflow are in place.

## Current Remaining Risk

- Frontend coverage still needs the branch threshold tightened so the shell
  surface reflects the agreed verification target.
- Package-grade release validation still depends on deterministic backend
  readiness and environment-specific Tauri packaging behavior.

## Phase R5: Test-Layer Hardening (Unit + Integration + Playwright)

- R5-P0: Fix Playwright surface drift and pnpm bootstrap parity (`TH-001`, `TH-002`, `TH-003`).
- R5-P1: Remove skipped critical async shell tests and replace timeout-based stability with deterministic sync (`TH-004`, `TH-005`, `TH-007`).
- R5-P2: Deepen report-download table e2e checks, add mutation-style helper checks, and codify test-quality governance (`TH-008`, `TH-009`, `TH-010`).

Validation gate:
- `pnpm run test -- src/__tests__/app-shell.test.tsx src/lib/desktop.test.ts src/__tests__/app-helpers.test.ts`
- `pnpm run test:e2e`
- `pnpm run test:python`

## Phase R6: Adversarial UX Contract Hardening

- R6-F1: Keep report downloads single-surface (Reports tab only) and prevent duplicate action rendering.
- R6-F2: Keep Reports-tab download actions artifact-backed (`downloadUrl`) with no data-url fallback in operations table.
- R6-F3: Keep roadmap tab/report contract notes synchronized with implemented shell behavior after each tab UX change.

Validation gate:
- `pnpm run test -- src/__tests__/app-shell.test.tsx`
- Confirm Results tab has no "Formatted Reports" section.
- Confirm Reports table contains only artifact-backed action links when artifacts are available.
