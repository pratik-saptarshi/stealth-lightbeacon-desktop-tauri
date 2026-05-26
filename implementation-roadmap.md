# Implementation Roadmap

This roadmap now covers the full desktop-plus-backend program required to ship a
working Stealth Lightbeacon desktop app.

Verified state on 2026-05-26:

- Desktop repo work through `Phase 2B` is implemented locally and validated with
  Rust, TypeScript, and UI tests.
- The sibling backend repo `/Volumes/dev/Git-SCM/stealth-lightbeacon` is still a
  Typer CLI audit engine, not the HTTP/OpenAPI companion the desktop expects.
- The critical path has therefore moved from desktop-only work to cross-repo
  contract and lifecycle implementation.

See [desktop-backend-contract.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/desktop-backend-contract.md)
for the verified interface map and gap analysis.

## Delivery Loop For Every Phase

No phase is considered started until this loop begins.

1. Start-of-phase review
   - Review the prior phase exit criteria.
   - Review the current code in both repos, not only the planning docs.
   - Review the pinned OpenAPI snapshot and the backend repo's generated or
     served OpenAPI artifact.
   - Review open findings in
     [plan-review-traceability.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/plan-review-traceability.md).
   - Lock scope with an explicit "not in this phase" list.
2. Test-first work
   - Add failing producer tests in the backend repo first.
   - Add failing consumer tests in the desktop repo second.
   - Add or tighten at least one integration check proving the repos still align.
   - Include at least one non-happy-path case for every new boundary.
3. Implementation
   - Implement the minimum change set required to make the new tests pass.
   - Keep the backend repo authoritative for API semantics, job state, results,
     artifacts, recon output, and version identity.
   - Keep the desktop repo authoritative only for local config, local snapshot
     cache, and trusted transport behavior inside Rust.
4. Validation gate
   - Re-run all previously green targeted suites.
   - Re-run the repo-wide suites touched by the phase.
   - Run one manual smoke path for the operator-visible behavior added in the
     phase.
   - Do not advance while any touched-scope blocker is open.

## Gap Buckets

- `Feature gap`: missing operator-visible workflow or backend route.
- `Capability gap`: missing runtime, lifecycle, policy, or storage behavior.
- `Validation gap`: missing schema, compatibility, or safety guardrail.
- `Testing gap`: missing automated coverage at the contract, transport, or
  end-to-end boundary.

## Current Completion Baseline

### Desktop Repo

- `Phase 1R`: complete
- `Phase 2A`: complete
- `Phase 2B`: complete

### Backend Repo

- CLI evaluation flow: complete for its own product line
- Desktop companion HTTP/OpenAPI surface: not started
- Job lifecycle and artifact API: not started
- Companion lifecycle and remote policy surface: not started

## Phase 0A: Contract Re-Baseline Across Repos

The current pinned snapshot in the desktop repo is more complete than the
backend repo's actual public interface. This phase makes the contract honest and
gives both repos one source of truth.

### Start-Of-Phase Review

- Review
  [contracts/backend-api.openapi.json](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/contracts/backend-api.openapi.json).
- Review the backend repo's actual externally visible interfaces: CLI commands,
  env contract, report outputs, and recon helper behavior.
- Review the request and response mismatches documented in
  [desktop-backend-contract.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/desktop-backend-contract.md).

### Test-First Work

- Add a failing backend test that proves a generated or served OpenAPI 3.1
  artifact exists.
- Add failing backend schema tests for `ApiError`, `HealthResponse`, and
  `CapabilitiesResponse`.
- Add a failing desktop contract-sync test that rejects stale or incompatible
  snapshots.

### Implementation

- Make the backend repo the producer of the canonical OpenAPI 3.1 contract.
- Reconcile route list, request bodies, response bodies, and error envelope with
  the desktop's implemented expectations.
- Decide and document whether `profile`, `outputFormats[]`, and `budgetGate`
  remain stable API fields or are changed on both sides.
- Rename the desktop snapshot description so it no longer claims to be a
  "Phase 1" snapshot once the broader route set is intentional.

### Validation Gate

- Backend: generated OpenAPI artifact test passes.
- Desktop: snapshot sync and schema assertions pass.
- Both repos: contract diff reviewed with no unresolved drift.

### Exit Criteria

- `/openapi.json` or an equivalent generated backend artifact exists.
- Desktop and backend repos agree on the same route set and core DTO names.
- Contract drift becomes a CI failure instead of a doc-only note.

## Phase 0B: Extract A Backend Service Layer From The CLI

The backend repo already has an audit engine, but it is wired as a synchronous
Typer workflow. It needs a hostable service layer before an HTTP companion can
exist safely.

### Start-Of-Phase Review

- Review the orchestration path around `run_evaluation(...)`, report rendering,
  recon inspection, and artifact emission in the backend repo.
- Review the backend repo's current BEADS plan to avoid regressing its own CLI
  guarantees.

### Test-First Work

- Add failing backend service-layer tests that preserve current CLI behavior.
- Add failing tests for a reusable evaluation service abstraction that returns
  structured result, artifact, and failure objects instead of only process exit
  codes and files.

### Implementation

- Split the backend CLI into thin adapter plus reusable service layer.
- Introduce explicit backend-domain types for:
  - evaluation request
  - evaluation status
  - terminal result
  - artifact descriptor
  - recon response
- Preserve the CLI surface as an adapter over the new service layer.

### Validation Gate

- Existing backend CLI tests remain green.
- New service-layer tests pass without route work yet.

### Exit Criteria

- The audit engine is callable without going through `typer`.
- Report generation and artifact discovery are reusable by an HTTP server.

## Phase 1A: Backend HTTP Skeleton, Health, Capabilities, And Error Envelope

This phase creates the first real desktop-consumable backend surface.

### Start-Of-Phase Review

- Review the desktop's existing `apiHealthCheck()` and `getCapabilities()`
  expectations.
- Review local and remote mode assumptions in
  [src/App.tsx](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src/App.tsx)
  and
  [src-tauri/src/lib.rs](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs).

### Test-First Work

- Add failing backend route tests for `GET /health` and `GET /capabilities`.
- Add failing backend tests for structured `ApiError` envelopes.
- Add failing desktop integration tests against a real backend test server, not
  only stubs.

### Implementation

- Add an HTTP server adapter in the backend repo.
- Implement `GET /health` with `status`, `service`, `apiVersion`, and
  `appVersion`.
- Implement `GET /capabilities` with `apiMode`, `evaluationProfiles`,
  `outputFormats`, `supportsRecon`, and `supportsArtifacts`.
- Decide the initial truth for `apiMode.supportsRemote`.

### Validation Gate

- Backend route tests pass.
- Desktop health and capabilities checks pass against the real backend server.
- The same `ApiError` envelope is emitted by backend, preserved by Rust, and
  surfaced by TypeScript.

### Exit Criteria

- The desktop can point at the backend repo's HTTP process and complete
  bootstrap honestly.

## Phase 1B: Evaluation Submission And Polling Job Model

This phase closes the largest structural gap: the backend must expose accepted
jobs and status polling instead of a synchronous CLI-only run.

### Start-Of-Phase Review

- Review the desktop request shape and the backend CLI argument model.
- Review which fields require translation, removal, or backend-native adoption.

### Test-First Work

- Add failing backend route tests for `POST /evaluations` and
  `GET /evaluations/{evaluation_id}`.
- Add failing backend tests for terminal, non-terminal, validation-failure, and
  not-found states.
- Add failing desktop end-to-end tests proving the current poller works against
  the real backend responses.

### Implementation

- Introduce backend-owned evaluation IDs and run-state storage.
- Map desktop request fields onto backend service-layer inputs.
- Define status transitions, `terminal`, `exitState`, `progressPercent`, and
  operator-facing `message`.
- Keep report and artifact generation bound to the evaluation ID lifecycle.

### Validation Gate

- Backend route tests and job-state tests pass.
- Desktop create-and-poll flow passes against the backend test server.
- Invalid requests fail as `ApiError`, not as CLI-like exit codes.

### Exit Criteria

- The backend is now a real producer for the desktop's base workflow.
- The desktop's already-implemented `Phase 1R` behavior is validated against the
  real backend, not only stubs.

## Phase 2A: Terminal Result Contract Alignment

The desktop already renders terminal results. This phase makes the backend emit
that result shape.

### Start-Of-Phase Review

- Review the desktop's `EvaluationResultResponse` and rendering assumptions.
- Review the backend's normalized report payload and issue vocabulary.

### Test-First Work

- Add failing backend route tests for
  `GET /evaluations/{evaluation_id}/result`.
- Add failing backend mapping tests from internal report payload to desktop
  result DTO.
- Add failing desktop integration tests for successful and failing result
  retrieval against the real backend server.

### Implementation

- Define the terminal result DTO in the backend repo.
- Reconcile severity vocabulary and findings shape.
- Either emit the desktop's current `summary/findings/severityCounts` contract
  or update both repos together with explicit snapshot and UI changes.

### Validation Gate

- Backend result mapping tests pass.
- Desktop result retrieval and rendering pass against the backend server.

### Exit Criteria

- `Phase 2A` is real end-to-end, not desktop-only.

## Phase 2B: Artifact Descriptor And Last-Opened Snapshot Alignment

The desktop already consumes artifact descriptors and caches the last-opened
terminal snapshot. This phase makes the backend authoritative for artifact
discovery.

### Start-Of-Phase Review

- Review the desktop artifact descriptor type and snapshot cache assumptions.
- Review current backend report file naming and output directory behavior.

### Test-First Work

- Add failing backend route tests for
  `GET /evaluations/{evaluation_id}/artifacts`.
- Add failing backend tests for descriptor generation from produced report
  files.
- Add failing desktop integration tests for artifact retrieval against the real
  backend server.

### Implementation

- Expose artifact descriptors with `name`, `kind`, `mediaType`, and
  `downloadUrl` or equivalent local fetch semantics.
- Keep the backend authoritative for artifact presence and location.
- Keep the desktop snapshot cache intentionally thin.

### Validation Gate

- Backend artifact-route tests pass.
- Desktop artifact rendering and snapshot restore continue to pass.

### Exit Criteria

- Result plus artifact flow is complete end to end.

## Phase 3A: Local Companion Lifecycle Management

Once the backend companion exists, local mode must become a real managed mode
instead of a label.

### Start-Of-Phase Review

- Review the desktop's local-mode assumptions and startup UX.
- Review backend process startup, readiness, shutdown, logging, and port policy.

### Test-First Work

- Add failing desktop lifecycle tests for start, readiness probe, degraded
  startup, and shutdown.
- Add failing backend smoke tests for companion startup on the loopback target.

### Implementation

- Add desktop-managed local companion launch and shutdown in Rust.
- Add backend readiness behavior that distinguishes booting, healthy, and
  degraded states.
- Decide packaging boundary for the local companion binary or runtime.

### Validation Gate

- Local companion lifecycle tests pass.
- Manual smoke: start desktop, auto-start companion, submit evaluation, close
  cleanly.

### Exit Criteria

- Local mode is a true product capability.

## Phase 3B: Remote Auth, Version Compatibility, And Transport Policy

Remote mode must become honest before it can remain in the UI.

### Start-Of-Phase Review

- Review how the backend repo currently uses `SLB_AUTH_TOKEN`.
- Review the desktop repo's remote-mode, TLS, and version assumptions.

### Test-First Work

- Add failing backend tests for unauthorized responses and version mismatch
  payloads.
- Add failing desktop tests for remote auth-required, incompatible-version, and
  unsafe-target states.

### Implementation

- Separate backend API auth from audited-target auth.
- Add backend version compatibility semantics to `/health` or `/capabilities`.
- Define desktop storage boundaries for remote auth references.
- Enforce remote transport policy in Rust.

### Validation Gate

- Auth and version-mismatch tests pass in both repos.
- Remote mode blocks unsafe or incompatible targets before submission.

### Exit Criteria

- Remote mode is a true policy-driven runtime path.

## Phase 4: Recon Advisory API Alignment

Recon exists in the backend repo today, but only as CLI/helper behavior. This
phase exposes it through the shared contract.

### Start-Of-Phase Review

- Review current backend `ReconAdvisor` output shape.
- Review the desktop repo's pinned `POST /recon` contract and future UI copy.

### Test-First Work

- Add failing backend route tests for `POST /recon`.
- Add failing backend DTO mapping tests from internal recon model to contract
  response.
- Add failing desktop integration tests for capability-gated recon behavior.

### Implementation

- Expose recon as a backend HTTP endpoint.
- Reconcile recon response shape across repos.
- Keep recon advisory and backend-defined.

### Validation Gate

- Backend recon tests pass.
- Desktop recon UI passes against the real backend.

### Exit Criteria

- Recon is additive, capability-gated, and cross-repo validated.

## Phase 5: Release Hardening, Contract Sync Automation, And Final Validation

Only after the full workflow is real should the release and hardening layer be
closed.

### Start-Of-Phase Review

- Review all remaining hardening items in
  [backlog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/backlog.md).
- Review packaging strategy for both repos.

### Test-First Work

- Add failing contract-sync automation checks between backend-generated OpenAPI
  and desktop-pinned snapshot.
- Add failing end-to-end smoke checks for local and remote modes.
- Add failing packaging smoke checks where automation is available.

### Implementation

- Automate snapshot sync and contract diff gating.
- Finalize retry, timeout, TLS, and plaintext policy.
- Finalize compatibility matrix and release validation steps.
- Finalize desktop bundling and companion distribution strategy.

### Validation Gate

- Backend and desktop suites pass together.
- Contract-sync automation is green.
- Manual smoke: local companion mode and remote mode both work as documented.

### Exit Criteria

- The desktop app is honestly working end to end.
- Contract drift is gated automatically.
- Release readiness is documented and reproducible.

## Completion Definition

The program is complete when:

1. the backend repo exposes the documented OpenAPI surface
2. the desktop repo's implemented transport and UI flows are validated against
   that real backend
3. local and remote modes are real policies, not labels
4. recon is exposed only as a capability-gated additive workflow
5. contract, adapter, UI, IPC, integration, and release validation stay green
   together
