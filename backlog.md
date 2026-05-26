# Desktop Backlog

This file merges the original phased plan with the current codebase audit and
the adversarial review backlog. Status reflects the repository as validated on
2026-05-26.

## Phase Audit

| Phase | Status | Tracking note |
| --- | --- | --- |
| 0. Contract reset | Complete with drift | API-first docs, local OpenAPI snapshot, and contract tests exist. The snapshot now includes later-phase routes, so it is no longer Phase-1-limited. |
| 1. Connectivity and evaluation lifecycle | Complete with remediation follow-up | The real runtime path uses Tauri Rust plus HTTP for config, health, capabilities, create, and polling. Review work remains on error handling, contract enforcement, and recovery behavior. |
| 2. Results and artifacts | Partial | Contract routes exist, but the desktop runtime has no TS bindings, Tauri commands, or UI for result and artifact retrieval. |
| 3. Recon | Not started | Recon appears in the contract, but no desktop implementation exists. |
| 4. Hybrid local and remote backend operations | Partial | Mode selection exists, but local companion lifecycle, remote auth, and compatibility enforcement are still missing. |
| 5. History and release hardening | Not started | No intentional result/history cache, release bundle flow, compatibility matrix, or hardening policy exists yet. |

## Merged Remaining Backlog

### Phase 1 Follow-Up Remediation

- P1-H1: Surface corrupted persisted-config failures instead of silently falling
  back to the localhost default.
- P1-H2: Preserve structured `ApiError` semantics across Rust and TypeScript
  instead of collapsing non-2xx responses into raw text.
- P1-H3: Add a real Tauri IPC integration lane that exercises `invoke` command
  names and payload shapes instead of only mocking `src/lib/desktop.ts`.
- P1-M1: Enforce contract-valid form state in React before submit, including at
  least one output format and numeric bounds.
- P1-M2: URL-encode `evaluation_id` path segments and add regression tests for
  non-trivial IDs.
- P1-M3: Stop optimistic capability fallback from enabling submissions when
  `/capabilities` failed or returned incompatible data.
- P1-M4: Sanitize backend error details before surfacing them in the operator
  UI.
- P1-M5: Add retry and manual recovery behavior for transient polling failures.
- P1-M6: Either persist minimal active-session metadata and resume polling on
  bootstrap, or keep docs explicit that only backend config is persisted.

### Phase 2: Results And Artifacts

- P2-H1: Add Rust commands and TS bindings for
  `GET /evaluations/{evaluation_id}/result`.
- P2-H2: Add Rust commands and TS bindings for
  `GET /evaluations/{evaluation_id}/artifacts`.
- P2-H3: Replace placeholder terminal-state UI with report rendering, findings
  summary, and artifact metadata/actions.
- P2-M1: Add thin local cache only for last-opened result metadata and clearly
  separate it from backend-authoritative state.
- P2-M2: Add desktop integration tests for success and failure terminal states
  with result/artifact retrieval.

### Phase 3: Recon

- P3-H1: Add recon request/response models and Tauri commands for `POST /recon`.
- P3-H2: Add capability-driven recon UI with advisory language only.
- P3-M1: Keep recon fields plain and backend-defined; do not expose MCP, agent,
  or AI framing in UI copy or contract notes.
- P3-M2: Add recon contract and mapping tests across snapshot, Rust, and
  TypeScript.

### Phase 4: Hybrid Local And Remote Backend Operations

- P4-H1: Implement local companion lifecycle management in Rust, including
  startup probe, retry window, and shutdown behavior.
- P4-H2: Make `BackendMode` enforce real policy rather than act as a label:
  loopback expectations for local mode, explicit remote policy, and later auth
  storage hooks.
- P4-H3: Add backend API version compatibility checks instead of only displaying
  `apiVersion`.
- P4-M1: Add remote auth configuration references and a safe storage plan before
  any secret-bearing remote flow ships.
- P4-M2: Add reachability, version-mismatch, and mode-specific UX states to the
  desktop shell.

### Phase 5: History And Release Hardening

- P5-H1: Define the final thin-cache scope for recent evaluations and last-opened
  result snapshots.
- P5-H2: Add a compatibility matrix covering desktop build version versus pinned
  backend API version.
- P5-H3: Harden retry, timeout, TLS, and plaintext remote policy.
- P5-H4: Enable and validate desktop bundling, packaging, and signed release
  smoke checks.
- P5-M1: Add automated snapshot diff/sync workflow against the backend repo's
  `openapi.json`.
- P5-M2: Add non-happy-path adapter tests for timeout, decode failure, and
  structured backend error paths.

## Drift And Accuracy Notes

- The pinned OpenAPI fixture already includes Phase 2 and Phase 3 routes, so it
  should not be described as a strict Phase 1 snapshot.
- The current desktop runtime persists backend config only; it does not persist
  active evaluation metadata.
- The UI advertises future artifact support, but artifact retrieval is not wired
  in the desktop adapter yet.
- Remote mode exists in UI and config, but remote auth, TLS policy, and version
  compatibility are still backlog items.
