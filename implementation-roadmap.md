# Implementation Roadmap

This document is the execution plan for finishing the desktop client. It
integrates the phase audit, the adversarial review findings, and the remaining
feature scope into a TDD-first delivery sequence.

## Delivery Rules

Every phase uses the same loop and is not considered started until the review
and test-first work is in place.

1. Start-of-phase review
   - review the touched code paths against the prior phase exit criteria
   - review the current backlog and drift notes
   - review the pinned OpenAPI snapshot and route/schema assumptions
   - lock scope with an explicit "not in this phase" list
2. Test-first work
   - add or tighten failing tests before implementation
   - prefer contract tests, Rust adapter tests, IPC integration tests, then UI
     tests
   - include at least one non-happy-path case for every new boundary
3. Implementation
   - implement the minimum change set needed to make the new failing tests pass
   - keep React behind `src/lib/desktop.ts`
   - keep Rust as the trusted boundary for config, transport, and policy
4. Validation gate
   - re-run all previously green suites
   - add one manual smoke pass for the phase's user-facing path
   - do not advance the phase while open blockers remain in the touched scope

## Gap Taxonomy

The remaining work is tracked using four gap types.

- `Feature gap`: missing operator-visible workflow or UI
- `Capability gap`: missing runtime/platform behavior needed to support or ship
  features safely
- `Validation gap`: missing guardrails that prevent invalid or unsafe runtime
  behavior
- `Testing gap`: missing automated coverage for a contract, boundary, or
  failure mode

See [plan-review-traceability.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/plan-review-traceability.md)
for the finding-by-finding mapping.

## Phase 0

### Why This Phase Now

The old roadmap was too short and too feature-linear. It did not account for
the Phase 1 remediation, the contract drift already present in the pinned
snapshot, or the need to separate feature work from capability and validation
work.

### Start-Of-Phase Review

- Reconcile `README.md`, `architecture.md`, `backlog.md`, and this roadmap.
- Confirm that the pinned OpenAPI snapshot is broader than the implemented
  desktop runtime.
- Confirm the original phase audit remains preserved in `backlog.md`.

### Feature Work

- None. This phase is planning and execution-order correction only.

### Capability Work

- Define the expanded execution phases:
  - `Phase 1R`
  - `Phase 2A`
  - `Phase 2B`
  - `Phase 3`
  - `Phase 4`
  - `Phase 5`

### Validation And Test Work

- Re-run the current repo audit before opening implementation work.
- Verify which existing tests are mocked-only and which ones touch real adapter
  behavior.

### Explicit Deferrals

- No runtime code changes land in this phase.

### Entry Criteria

- Current roadmap and backlog have been reviewed against the review findings.

### Exit Criteria

- The execution order below is accepted as the source of truth for future work.
- Phase 0 no longer treats the OpenAPI fixture as Phase-1-limited.

## Phase 1R: Reliability And Contract Guardrails

### Why This Phase Now

The desktop already submits and polls, but the current path is not safe enough
to treat as complete. Reliability, recovery, and boundary correctness must move
ahead of new feature work.

### Start-Of-Phase Review

- Review `src/App.tsx`, `src/lib/desktop.ts`, and `src-tauri/src/lib.rs`.
- Review current Rust, React, Python contract, and any IPC test coverage.
- Review the active `P1-*` remediation findings in `backlog.md`.

### Feature Work

- Add operator-visible bootstrap and recovery behavior for invalid persisted
  config.
- Add clear UI behavior for capability-unavailable and transient polling failure
  states.
- Decide one of:
  - persist minimal active-session metadata and resume polling on bootstrap, or
  - keep docs and UI explicit that only backend config is persisted

### Capability Work

- Preserve structured `ApiError` semantics across Rust and TypeScript.
- Make config loading fail closed instead of silently reverting to localhost.
- Enforce contract-valid form state before submit.
- URL-encode `evaluation_id` path segments centrally.
- Remove optimistic capability fallback from the active submit path.
- Sanitize backend error details before surfacing them in the operator UI.
- Add retry and manual recovery behavior for transient polling failures.
- Add the minimum mode-policy floor needed to keep exposed `local` and `remote`
  choices honest.

### Validation And Test Work

- Add failing Rust tests for:
  - corrupted persisted config
  - encoded path parameters
  - structured `ApiError` propagation
  - polling retry/recovery behavior
- Add failing React tests for:
  - invalid form state
  - capability-failure disablement
  - recovery messaging
- Add a real Tauri IPC integration lane that exercises command names and payload
  shapes instead of only mocking `src/lib/desktop.ts`.
- Keep Python contract checks green while tightening route and schema usage
  assertions where useful.

### Explicit Deferrals

- No result rendering yet
- No artifact retrieval yet
- No recon yet
- No release packaging work beyond keeping the phase testable locally

### Entry Criteria

- Phase 0 complete
- Current suites green or failures already understood and intentionally covered
  by the new phase tests

### Exit Criteria

- The create-and-poll path is recoverable, contract-valid, and accurately
  documented.
- The repo has at least one real desktop IPC test lane in addition to mocked UI
  tests.
- All new failing tests introduced for this phase are green.

## Phase 2A: Terminal Result Retrieval

### Why This Phase Now

A working desktop app must render terminal evaluation data, not just accept a
job and poll status.

### Start-Of-Phase Review

- Review the `/result` contract shape and the terminal-state UI.
- Review how terminal states are currently represented in Rust, TS, and React.
- Review which Phase 1R tests can be extended rather than duplicated.

### Feature Work

- Render terminal report data in the desktop app.
- Show score summary, findings summary, and terminal-state specific report
  content.

### Capability Work

- Add Rust command support for `GET /evaluations/{evaluation_id}/result`.
- Add TypeScript binding support for result retrieval.
- Normalize terminal result mapping so UI rendering does not parse raw backend
  transport state ad hoc.

### Validation And Test Work

- Add failing Rust stub-server tests for result retrieval:
  - success
  - non-2xx
  - timeout
  - decode failure
- Add failing adapter/UI tests proving result fetch starts only after terminal
  status.
- Add UI tests for successful and unsuccessful terminal result rendering.

### Explicit Deferrals

- No artifact retrieval in this subphase
- No local snapshot beyond what is strictly required to keep terminal rendering
  coherent in-memory

### Entry Criteria

- Phase 1R exit criteria met
- The `/result` snapshot contract is stable enough to bind

### Exit Criteria

- An operator can connect, submit, poll to terminal, and inspect final result
  data in the desktop app.
- All result retrieval tests and prior suites are green.

## Phase 2B: Artifact Retrieval And Last-Opened Snapshot

### Why This Phase Now

Artifacts complete the terminal workflow and are the first legitimate place to
introduce the thin local cache promised by the architecture.

### Start-Of-Phase Review

- Review the `/artifacts` contract shape and the intended artifact UX.
- Review the thin-cache boundaries defined in `architecture.md`.

### Feature Work

- Render artifact metadata and operator actions.
- Restore only the last-opened terminal snapshot metadata needed for a fast
  reopen flow.

### Capability Work

- Add Rust command support for `GET /evaluations/{evaluation_id}/artifacts`.
- Add TypeScript binding support for artifact retrieval.
- Persist the smallest acceptable last-opened result metadata snapshot without
  turning the desktop into the source of truth for history.

### Validation And Test Work

- Add failing Rust and adapter tests for artifact retrieval.
- Add UI tests for artifact metadata/actions.
- Add restart/reload tests proving only the intended thin-cache metadata is
  restored.

### Explicit Deferrals

- No broad history view
- No recon
- No release packaging work beyond keeping artifact behavior locally testable

### Entry Criteria

- Phase 2A exit criteria met

### Exit Criteria

- The desktop app supports end-to-end result and artifact retrieval.
- Thin-cache behavior is explicit, minimal, and covered by tests.

## Phase 3: Hybrid Desktop Operability

### Why This Phase Now

`local` and `remote` already exist in the app surface. They need to become real
operational modes with honest policy and failure behavior before the product can
be treated as a dependable desktop client.

### Start-Of-Phase Review

- Review local/remote mode handling in Rust and React.
- Review what behavior is merely label-level today.
- Confirm whether the product definition of a "working desktop app" requires a
  desktop-managed local companion backend.

### Feature Work

- Add honest local/remote mode UX.
- Surface startup, reachability, degraded, recovery, and version-mismatch
  states.
- Surface companion status when local mode manages a backend lifecycle.

### Capability Work

- Implement local companion lifecycle management in Rust.
- Make `BackendMode` enforce real policy rather than act as a label.
- Add backend API version compatibility checks.
- Define safe remote auth configuration references and storage boundaries.
- Add mode-specific reachability and policy handling.

### Validation And Test Work

- Add failing Rust tests for:
  - local startup probe
  - retry window
  - shutdown behavior
  - loopback/local policy
  - remote version mismatch
  - remote auth/unauthorized behavior
- Add failing UI tests for:
  - local startup and degraded states
  - recovery states
  - auth-required and version-mismatch states

### Explicit Deferrals

- No recon in this phase
- No broad history view
- No final release-signing automation

### Entry Criteria

- Phase 2B exit criteria met
- Local versus remote product intent is explicit enough to implement real policy

### Exit Criteria

- If a mode is visible in the UI, its policy and failure behavior are actually
  implemented.
- Unsafe or incompatible remote targets are blocked before submission.

## Phase 4: Recon Advisory Flow

### Why This Phase Now

Recon is additive. It should land only after the base desktop workflow and mode
behavior are reliable.

### Start-Of-Phase Review

- Review `/recon` contract shape and capability semantics.
- Review copy and UX language to keep recon backend-defined and non-AI-framed.

### Feature Work

- Add capability-driven recon UI.
- Keep recommendations advisory and backend-defined.

### Capability Work

- Add recon request/response models in Rust and TypeScript.
- Add a Tauri command and adapter binding for `POST /recon`.

### Validation And Test Work

- Add or tighten contract assertions for recon route/schema usage.
- Add failing Rust mapping tests for recon requests and responses.
- Add failing React tests for recon capability gating and advisory copy.

### Explicit Deferrals

- No automatic recon chaining into evaluation submission unless the backend
  contract makes that behavior explicit later

### Entry Criteria

- Phases 1R through 3 complete
- Recon capability semantics confirmed upstream

### Exit Criteria

- Recon is available only when supported and is clearly additive, not
  foundational.

## Phase 5: History And Release Hardening

### Why This Phase Now

Once the base workflows are complete, the remaining work is release readiness,
thin-cache discipline, transport hardening, and packaging confidence.

### Start-Of-Phase Review

- Review all remaining hardening items in `backlog.md`.
- Review packaging state in `src-tauri/tauri.conf.json`.
- Review current cache scope versus intended history UX.

### Feature Work

- Add only the minimal history UX that matches the agreed thin-cache scope.

### Capability Work

- Define the compatibility matrix between desktop build version and backend API
  version.
- Add automated snapshot diff/sync workflow against the backend repo
  `openapi.json`.
- Harden retry, timeout, TLS, and plaintext remote policy.
- Enable bundling, packaging, and release automation.

### Validation And Test Work

- Add non-happy-path adapter tests for:
  - timeouts
  - decode failures
  - structured backend error paths
- Add history/cold-start tests for the final thin-cache scope.
- Add packaging smoke checks and release verification steps.

### Explicit Deferrals

- No desktop-authoritative historical run store
- No scope growth beyond the approved thin-cache model

### Entry Criteria

- Phases 1R through 4 complete
- Final cache scope approved

### Exit Criteria

- The desktop build is releasable with documented compatibility expectations and
  reproducible packaging validation.

## Definition Of Done

The roadmap is complete when:

1. the desktop app can connect to a backend, submit work, recover from expected
   failures, and render terminal results and artifacts
2. exposed local/remote modes are real policies, not labels
3. recon is additive and capability-gated
4. thin-cache scope is explicit and validated
5. the desktop build has contract, adapter, UI, IPC, and release validation
   gates that remain green together
