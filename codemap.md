# stealth-lightbeacon-desktop-tauri/

## Responsibility

This repository is the Tauri desktop client for Stealth Lightbeacon. It owns
desktop-local state, trusted transport behavior, local companion lifecycle, and
operator UX for the implemented routes. The sibling backend repo remains
authoritative for evaluation state, results, artifacts, recon output, and the
canonical OpenAPI contract.

## Design

- `src/` hosts the React application shell and operator-visible workflow.
- `src/lib/desktop.ts` is the only frontend adapter and normalizes Rust/Tauri
  responses into TypeScript-friendly types.
- `src-tauri/src/lib.rs` is the trusted desktop runtime. It persists config,
  manages local companion startup and shutdown, enforces remote transport
  policy, injects desktop compatibility headers, and maps backend errors into a
  stable IPC shape.
- `contracts/backend-api.openapi.json` is the pinned snapshot of the backend's
  OpenAPI contract.
- `tests/contracts/`, `src/__tests__/`, and Rust tests validate contract,
  adapter, UI, and transport behavior.
- `scripts/check_contract_sync.py` and `scripts/release_validate.py` form the
  release gate for contract drift and cross-repo validation.

## Flow

1. React loads persisted backend config through Tauri.
2. Rust loads `backend-config.json` and optional terminal snapshot state from
   the app config directory.
3. React refreshes `/health` and `/capabilities`.
4. In local mode, Rust can auto-start the sibling backend companion and wait
   for readiness before requests proceed.
5. Submission flows through `POST /evaluations`, polling through
   `GET /evaluations/{evaluation_id}`, and terminal retrieval through result and
   artifact routes.
6. The adapter can call `POST /recon`, but the operator workflow for recon is
   still backlog work in `src/App.tsx`.
7. Release validation checks contract sync, backend tests, desktop tests, Rust
   tests, frontend build, and Tauri package build.

## Completion Status

- Phase `0`, `1`, and `2`: complete and validated.
- Phase `3`, `4`, and `5`: partial, with remaining work in recon UI, remote
  policy UX, packaging, and GitHub publication workflow.

## Integration

- Backend worktree validated against this repo:
  `/private/tmp/stealth-lightbeacon-phase-0a-0b`
- Canonical desktop contract snapshot:
  `contracts/backend-api.openapi.json`
- Primary truth docs:
  - `README.md`
  - `architecture.md`
  - `backlog.md`
  - `readme-CLI.md`
