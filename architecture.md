# Desktop Architecture

This repository implements the desktop operator client for Stealth
Lightbeacon. The backend executes evaluations and remains authoritative for
job state, results, artifacts, and future recon output. The desktop client is a
thin transport and UX layer.

## System Shape

1. React renders connection, submission, and polling workflow.
2. The frontend calls Tauri commands through `src/lib/desktop.ts`.
3. Rust validates local input, persists local settings, and performs HTTP
   requests to the backend API.
4. The backend API owns evaluation lifecycle state and contract semantics.

## Trust Boundaries

- React is untrusted for filesystem access, credential storage, and raw
  transport behavior.
- Rust is the trusted desktop boundary for config validation, persistence, and
  transport error normalization.
- The backend is the source of truth for evaluation status and any terminal
  report data.

## Current Runtime Flow

### Bootstrap

1. Tauri starts and loads persisted `backend-config.json` from the app config
   directory.
2. React requests the saved config from Rust.
3. React checks backend reachability and capability data.

### Evaluation Lifecycle

1. The operator edits backend config and saves it through Tauri.
2. The operator submits an evaluation request from the React form.
3. Rust validates the payload and sends `POST /evaluations`.
4. React stores the accepted evaluation ID in memory and polls
   `GET /evaluations/{evaluation_id}` until the backend reports `terminal=true`.

## Contract Boundary

The intended contract source of truth is the backend's `/openapi.json`. This
repo currently pins a local snapshot at `contracts/backend-api.openapi.json`.
That snapshot is validated by tests, but the runtime DTOs are still maintained
manually in both TypeScript and Rust. That means the contract boundary is
documented and tested, but not yet generated or enforced end to end.

## Implemented Versus Planned

- Implemented now:
  - backend config persistence
  - health and capability checks
  - evaluation create and status polling
- Planned but not yet implemented:
  - result retrieval
  - artifact retrieval and actions
  - recon commands and UX
  - local companion process lifecycle
  - remote auth and API compatibility enforcement
  - thin cache for last-opened result metadata and history views

## Known Architectural Drift

- The pinned snapshot already contains Phase 2 and Phase 3 routes, while the
  desktop runtime only wires Phase 1 routes.
- The UI exposes `local` and `remote` modes, but the Rust layer does not yet
  enforce different policy for loopback, TLS, auth, or versioning.
- Current persistence covers only backend config, not active evaluation
  metadata.

## Explicit Exclusions

- No Python sidecar orchestration inside Tauri.
- No MCP configuration endpoints or agent-card surface.
- No semantic-search, vector, or LadyBugDB desktop feature line.
- No desktop-authoritative artifact or run history store.
