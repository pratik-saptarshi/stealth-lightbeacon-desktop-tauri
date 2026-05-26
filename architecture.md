# Desktop Architecture

This repository implements the desktop operator client for Stealth Lightbeacon.
The intended backend executes evaluations and remains authoritative for job
state, results, artifacts, and future recon output. The desktop client is a
thin transport and UX layer.

## System Shape

1. React renders connection, submission, polling, result, and artifact
   workflow.
2. The frontend calls Tauri commands through `src/lib/desktop.ts`.
3. Rust validates local input, persists local settings, and performs HTTP
   requests to the backend API.
4. The backend API owns evaluation lifecycle state and contract semantics.

## Cross-Repo Reality

The sibling repository `/Volumes/dev/Git-SCM/stealth-lightbeacon` is currently
implemented as a Typer CLI audit engine. It is not yet the HTTP/OpenAPI
companion that this desktop repo expects.

That means:

- the desktop repo's transport and UI flows through `Phase 2B` are implemented
  locally
- the remaining critical path is now cross-repo work in the backend repo:
  OpenAPI production, HTTP routes, evaluation job lifecycle, and companion
  process behavior
- completion of later desktop phases depends on that backend substrate becoming
  real

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
5. React then retrieves `GET /evaluations/{evaluation_id}/result` and
   `GET /evaluations/{evaluation_id}/artifacts`.
6. Rust persists only the thin last-opened terminal snapshot needed for fast
   restore.

## Contract Boundary

The intended contract source of truth is the backend's `/openapi.json`. This
repo currently pins a local snapshot at `contracts/backend-api.openapi.json`,
but the sibling backend repo does not yet produce that artifact. The runtime
DTOs are still maintained manually in both TypeScript and Rust. That means the
contract boundary is documented and tested locally, but not yet generated or
enforced end to end across repos.

## Implemented Versus Planned

- Implemented now in the desktop repo:
  - backend config persistence
  - health and capability checks
  - evaluation create and status polling
  - result retrieval and rendering
  - artifact retrieval and rendering
  - last-opened terminal snapshot persistence
- Planned but not yet implemented cross-repo:
  - backend HTTP/OpenAPI producer surface in the sibling repo
  - recon commands and UX against a real backend route
  - local companion process lifecycle
  - remote auth and API compatibility enforcement
  - thin cache for last-opened result metadata and any approved history views

## Known Architectural Drift

- The pinned snapshot already contains later routes, while the sibling backend
  repo does not yet expose those routes at all.
- The UI exposes `local` and `remote` modes, but the Rust layer does not yet
  enforce different policy for loopback, TLS, auth, or versioning.
- Current persistence covers backend config plus the thin last-opened terminal
  snapshot only.

## Explicit Exclusions

- No Python sidecar orchestration inside Tauri.
- No MCP configuration endpoints or agent-card surface.
- No semantic-search, vector, or LadyBugDB desktop feature line.
- No desktop-authoritative artifact or run history store.
