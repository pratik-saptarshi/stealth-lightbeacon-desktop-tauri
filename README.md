# Stealth Lightbeacon Desktop Client

This repository is the Tauri desktop client for Stealth Lightbeacon. The audit
engine and canonical backend API live in
`/Volumes/dev/Git-SCM/stealth-lightbeacon`. This repo is the thin desktop
boundary: it stores local connection settings, calls the backend over HTTP, and
renders operator workflow for evaluation submission and polling.

The backend companion contract is now produced from the sibling repo, and the
desktop repo validates its pinned snapshot against that producer before release.

## What Works Today

- Persist backend mode, base URL, and timeout in the Tauri app config
  directory.
- Validate backend reachability through `GET /health`.
- Load backend capabilities through `GET /capabilities`.
- Submit evaluations through `POST /evaluations`.
- Poll evaluation state through `GET /evaluations/{evaluation_id}` until a
  terminal state is returned.
- Retrieve terminal results through
  `GET /evaluations/{evaluation_id}/result`.
- Retrieve artifact descriptors through
  `GET /evaluations/{evaluation_id}/artifacts`.
- Run advisory recon through `POST /recon`.
- Auto-start and stop a managed local companion in desktop local mode.
- Enforce remote HTTPS-only transport, desktop compatibility headers, and remote
  auth via Rust-only environment lookup.
- Persist and restore the last-opened terminal snapshot.
- Validate contract sync, frontend adapter behavior, and Rust transport through
  scripted release validation.

## Current Completion Status

- Phase 0: complete.
- Phase 1: complete.
- Phase 2: complete.
- Phase 3: complete.
- Phase 4: complete.
- Phase 5: complete.

See [backlog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/backlog.md)
for the validated phase audit and merged remediation backlog.
See
[desktop-backend-contract.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/desktop-backend-contract.md)
for the verified backend contract delta.

## Architecture

- React in `src/` owns UI state and workflow rendering.
- `src/lib/desktop.ts` is the only frontend-to-Tauri adapter.
- Rust in `src-tauri/src/` is the trusted desktop boundary for validation,
  config persistence, and HTTP transport.
- The backend remains the source of truth for evaluation state, results,
  artifacts, and future recon behavior.

See [architecture.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/architecture.md)
for the transport and trust-boundary model.

## Contract

- Upstream source of truth: sibling backend repo serves `/openapi.json` and
  exports `contracts/backend-api.openapi.json`.
- Pinned local snapshot:
  [contracts/backend-api.openapi.json](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/contracts/backend-api.openapi.json)
- Contract drift gate: `npm run check:contract-sync`

## Release Boundary

- Local mode is supported through a sibling backend checkout or compatible
  companion runtime discovered from the workspace.
- Remote mode requires `https://` and reads the bearer token from
  `STEALTH_LIGHTBEACON_REMOTE_AUTH_TOKEN` in Rust, not persisted frontend
  config.
- The desktop package does not yet embed a Python runtime; the companion remains
  a separately versioned backend deliverable.

## Local Defaults

- Default local backend target: `http://127.0.0.1:8000`
- Frontend dev server: `http://localhost:1420`
- Release validation: `npm run validate:release`

## Developer Docs

- Repo map: [codemap.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/codemap.md)
- CLI and test commands:
  [readme-CLI.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/readme-CLI.md)
- Change log:
  [changelog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/changelog.md)
