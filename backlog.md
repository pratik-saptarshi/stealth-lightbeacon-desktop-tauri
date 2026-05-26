# Desktop Backlog

This file now tracks two things together:

- accurate completion status for the original desktop phase list
- the remaining cross-repo backlog required to make the desktop app work end to
  end with `/Volumes/dev/Git-SCM/stealth-lightbeacon`

Status was revalidated against code and docs on 2026-05-26.

## Original Phase Audit

| Phase | Status | Tracking note |
| --- | --- | --- |
| 0. Contract reset | Complete with drift | A pinned OpenAPI fixture exists, but it is ahead of the backend repo's actual public surface and still described too narrowly in older docs. |
| 1. Connectivity and evaluation lifecycle | Complete | Desktop code now has the `Phase 1R` remediation work: fail-closed config handling, capability gating, retry/recovery, typed errors, and IPC coverage. |
| 2. Results and artifacts | Complete in desktop repo; blocked for integrated validation | Result retrieval, artifact retrieval, and last-opened snapshot persistence are implemented in desktop code, but the sibling backend repo does not yet produce the required HTTP routes. |
| 3. Recon | Not started cross-repo | Desktop route placeholders and contract expectations exist, but the sibling backend repo exposes recon only as CLI/helper behavior. |
| 4. Hybrid local and remote backend operations | Blocked on backend substrate | Mode selection exists in desktop UI, but the sibling backend repo does not yet provide a local companion lifecycle, remote auth surface, or compatibility/version contract. |
| 5. History and release hardening | Not started | Thin-cache hardening, compatibility matrixing, contract-sync automation, and release packaging are still future work. |

## Cross-Repo Execution Order

The active implementation order is now defined by
[implementation-roadmap.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/implementation-roadmap.md).

| Program phase | Status | Tracking note |
| --- | --- | --- |
| 0A. Contract re-baseline across repos | Not started | Desktop snapshot exists, but backend does not yet produce OpenAPI 3.1. |
| 0B. Backend service extraction from CLI | Not started | Backend engine is reusable in principle, but still CLI-wired in practice. |
| 1A. Backend HTTP skeleton, health, capabilities | Not started | No backend HTTP server or route tests exist yet. |
| 1B. Evaluation submission and polling job model | Not started | Backend has no asynchronous evaluation ID or polling state model yet. |
| 2A. Terminal result contract alignment | Partial | Desktop consumer path is implemented; backend producer route is missing. |
| 2B. Artifact descriptor and snapshot alignment | Partial | Desktop consumer path is implemented; backend producer route is missing. |
| 3A. Local companion lifecycle management | Not started | Blocked on backend service existence. |
| 3B. Remote auth, version compatibility, transport policy | Not started | Blocked on backend service existence and contract re-baseline. |
| 4. Recon advisory API alignment | Not started | Blocked on backend route exposure and schema alignment. |
| 5. Release hardening and contract-sync automation | Not started | Depends on earlier phases producing a stable shared contract. |

## Merged Remaining Backlog

### Phase 0A: Contract Re-Baseline

- Feature gaps
  - P0A-F1: Decide whether the desktop's current route set remains the product
    contract or is changed on both sides.
- Capability gaps
  - P0A-C1: Make the backend repo produce the canonical OpenAPI 3.1 contract.
- Validation gaps
  - P0A-V1: Remove stale "Phase 1 snapshot" framing from the pinned contract.
  - P0A-V2: Reconcile request and response schema drift between desktop DTOs and
    backend CLI/report shapes.
- Testing gaps
  - P0A-T1: Add producer-side OpenAPI artifact tests.
  - P0A-T2: Add contract diff/sync checks in the desktop repo.

### Phase 0B: Backend Service Extraction

- Feature gaps
  - P0B-F1: None; this phase is substrate only.
- Capability gaps
  - P0B-C1: Extract evaluation, result, artifact, and recon services from the
    Typer CLI path.
  - P0B-C2: Define backend-native domain DTOs independent from CLI flags and
    report files.
- Validation gaps
  - P0B-V1: Preserve existing CLI behavior while extracting service seams.
- Testing gaps
  - P0B-T1: Add service-layer tests that preserve current CLI outputs and
    failure semantics.

### Phase 1A: Backend HTTP Skeleton, Health, Capabilities

- Feature gaps
  - P1A-F1: Add `GET /health`.
  - P1A-F2: Add `GET /capabilities`.
- Capability gaps
  - P1A-C1: Add HTTP server bootstrap and structured error handling.
  - P1A-C2: Emit backend version identity and capability discovery.
- Validation gaps
  - P1A-V1: Separate API auth concepts from audited-target auth concepts.
- Testing gaps
  - P1A-T1: Add backend route tests and desktop real-server bootstrap tests.

### Phase 1B: Evaluation Submission And Polling

- Feature gaps
  - P1B-F1: Add `POST /evaluations`.
  - P1B-F2: Add `GET /evaluations/{evaluation_id}`.
- Capability gaps
  - P1B-C1: Introduce backend-owned evaluation IDs and run-state storage.
  - P1B-C2: Map desktop request semantics onto backend execution semantics.
- Validation gaps
  - P1B-V1: Reconcile `profile`, `outputFormats[]`, `maxDepth`, `maxUrls`, and
    `budgetGate` with backend-native inputs.
  - P1B-V2: Replace CLI exit-code-only semantics with explicit API terminal
    state semantics.
- Testing gaps
  - P1B-T1: Add backend state-transition tests and desktop end-to-end poller
    tests against the real backend.

### Phase 2A: Terminal Result Alignment

- Feature gaps
  - P2A-F1: Add `GET /evaluations/{evaluation_id}/result` in the backend repo.
- Capability gaps
  - P2A-C1: Map backend normalized report data into a desktop-consumable result
    DTO.
- Validation gaps
  - P2A-V1: Reconcile severity vocabularies and findings shape.
  - P2A-V2: Reconcile budget-failure semantics with desktop `exitState`.
- Testing gaps
  - P2A-T1: Add backend result-route tests and desktop real-backend retrieval
    tests.

### Phase 2B: Artifact Alignment

- Feature gaps
  - P2B-F1: Add `GET /evaluations/{evaluation_id}/artifacts` in the backend
    repo.
- Capability gaps
  - P2B-C1: Introduce backend artifact descriptors independent from raw report
    filenames.
- Validation gaps
  - P2B-V1: Define artifact download or fetch semantics that work in local and
    remote modes.
- Testing gaps
  - P2B-T1: Add backend artifact-route tests and desktop real-backend artifact
    tests.

### Phase 3A: Local Companion Lifecycle

- Feature gaps
  - P3A-F1: Add desktop-managed local companion startup and shutdown UX.
- Capability gaps
  - P3A-C1: Add backend readiness, degraded-state, and bounded shutdown
    behavior.
  - P3A-C2: Decide packaging/distribution boundary for the local companion.
- Validation gaps
  - P3A-V1: Enforce loopback-only local policy where intended.
- Testing gaps
  - P3A-T1: Add companion lifecycle tests across both repos.

### Phase 3B: Remote Auth And Compatibility Policy

- Feature gaps
  - P3B-F1: Add honest remote unauthorized and incompatible-version UX.
- Capability gaps
  - P3B-C1: Add backend API auth semantics.
  - P3B-C2: Add backend version compatibility semantics.
  - P3B-C3: Add desktop transport policy for TLS and plaintext remote targets.
- Validation gaps
  - P3B-V1: Keep auth storage boundaries explicit and minimal in desktop code.
- Testing gaps
  - P3B-T1: Add remote unauthorized, TLS-policy, and version-mismatch tests.

### Phase 4: Recon Advisory API

- Feature gaps
  - P4-F1: Add `POST /recon` as a backend HTTP route.
  - P4-F2: Add capability-driven recon UI against the real backend.
- Capability gaps
  - P4-C1: Map current backend `ReconAdvisor` output into the shared DTO.
- Validation gaps
  - P4-V1: Keep recon advisory and backend-defined.
  - P4-V2: Reconcile current recon schema mismatch across repos.
- Testing gaps
  - P4-T1: Add backend recon-route tests and desktop integration tests.

### Phase 5: Release Hardening And Contract Sync

- Feature gaps
  - P5-F1: Add minimal final history UX only if it still matches the thin-cache
    model.
- Capability gaps
  - P5-C1: Finalize compatibility matrix and release packaging strategy.
  - P5-C2: Finalize retry, timeout, TLS, and plaintext policy.
- Validation gaps
  - P5-V1: Automate backend-to-desktop OpenAPI diff and sync checks.
- Testing gaps
  - P5-T1: Add cross-repo smoke validation for local and remote modes.
  - P5-T2: Add packaging smoke checks where automation exists.

## Drift And Accuracy Notes

- The desktop repo's runtime is ahead of several desktop docs; result and
  artifact flows are implemented in code even though older docs still marked
  Phase 2 partial.
- The sibling backend repo is still a CLI audit engine, not an HTTP companion.
- The desktop repo's default loopback target `http://127.0.0.1:8000` is a
  planned companion location, not a service currently implemented in the sibling
  backend repo.
- The desktop repo treats backend `/openapi.json` as the intended source of
  truth, but the sibling backend repo does not yet produce that artifact.
