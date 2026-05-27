# Agent Notes

- Read [codemap.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/codemap.md)
  first.
- Use the folder codemaps under `src/`, `src-tauri/`, and `src-tauri/src/`
  before structural edits.
- Treat
  [backlog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/docs/roadmap/backlog.md)
  as the source of truth for completion tracking and remaining remediation.
- This repo is an API-first desktop client. It is not the audit engine.
- React stays behind `src/lib/desktop.ts`.
- Rust in `src-tauri/src/lib.rs` is the trusted boundary for config
  persistence, local companion lifecycle, validation, and HTTP transport.
- The backend contract source of truth lives in the sibling backend repo and is
  pinned locally at `contracts/backend-api.openapi.json`.

## Repository Map

- `src/`: React shell for operator workflow, capability-gated submission,
  polling, result rendering, artifacts, and recon UX.
- `src/lib/desktop.ts`: typed Tauri adapter and error-normalization layer.
- `src-tauri/src/lib.rs`: trusted desktop runtime, local companion management,
  config persistence, transport policy, remote auth lookup, and IPC tests.
- `contracts/backend-api.openapi.json`: pinned backend OpenAPI snapshot consumed
  by desktop contract tests.
- `tests/contracts/`: contract assertions for the pinned OpenAPI snapshot.
- `scripts/check_contract_sync.py`: desktop-to-backend OpenAPI drift gate.
- `scripts/release_validate.py`: cross-repo validation lane, including Tauri
  packaging.

## Current Phase Reality

- Phase `0`, `1`, and `2` are implemented and validated across the desktop repo
  and the backend worktree at `/private/tmp/stealth-lightbeacon-phase-0a-0b`.
- Phase `3` is partial: recon transport exists in the adapter/runtime, but the
  operator workflow is not wired in `src/App.tsx`.
- Phase `4` is partial: local companion and remote policy substrate exist, but
  operator-facing auth and compatibility UX still needs completion.
- Phase `5` is partial: contract-sync and release validation exist, but GitHub
  publication plumbing is still missing in this checkout.
