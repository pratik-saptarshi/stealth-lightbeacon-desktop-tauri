# stealth-lightbeacon-desktop-tauri/

## Responsibility

This repository is the Tauri desktop client for Stealth Lightbeacon. It is no
longer a sidecar-orchestration repo. Its job is to persist local connection
settings, translate desktop actions into backend API calls, and render operator
workflow around evaluation submission and status polling.

## Design

The codebase is intentionally split into a thin-client architecture.

- `src/` hosts the React shell and all operator-facing state transitions.
- `src/lib/desktop.ts` is the only frontend adapter. It defines typed payloads
  and wraps Tauri `invoke(...)` calls.
- `src-tauri/src/` is the trusted desktop boundary. Rust owns config
  validation, filesystem persistence, HTTP transport, and command exposure.
- `contracts/backend-api.openapi.json` is the pinned local OpenAPI fixture used
  for contract-aware tests and roadmap alignment.
- `tests/contracts/` verifies the pinned contract, while `src/__tests__/` and
  Rust tests cover the UI shell and transport adapter separately.

The current implementation is Phase 1 complete: connection, submission, and
polling are real. Result retrieval, artifacts, recon, local companion
management, and release hardening remain roadmap work.

## Flow

1. React boots and asks Rust for persisted backend config.
2. Rust loads `backend-config.json` from the Tauri app config directory.
3. React triggers health and capability checks through Tauri commands.
4. Submission sends a typed evaluation request to Rust, which proxies it to
   `POST /evaluations`.
5. React polls `GET /evaluations/{evaluation_id}` through Rust until the
   backend reports a terminal state.
6. The backend remains authoritative for run state; the desktop only mirrors
   connection state and the active in-memory session.

## Integration

- Backend repo: `/Volumes/dev/Git-SCM/stealth-lightbeacon`
- Desktop contract fixture: `contracts/backend-api.openapi.json`
- Key repo docs:
  - `README.md` for operator/developer overview
  - `architecture.md` for transport and trust boundaries
  - `backlog.md` for validated phase status and merged remediation backlog
  - `readme-CLI.md` for local commands
