# Stealth Lightbeacon Desktop Client

This repository is the Tauri desktop client for Stealth Lightbeacon. The audit
engine and canonical backend API live in
`/Volumes/dev/Git-SCM/stealth-lightbeacon`. This repo is the thin desktop
boundary: it stores local connection settings, calls the backend over HTTP, and
renders operator workflow for evaluation submission and polling.

## What Works Today

- Persist backend mode, base URL, and timeout in the Tauri app config directory.
- Validate backend reachability through `GET /health`.
- Load backend capabilities through `GET /capabilities`.
- Submit evaluations through `POST /evaluations`.
- Poll evaluation state through `GET /evaluations/{evaluation_id}` until a
  terminal state is returned.
- Validate the pinned contract fixture with Python tests and the transport
  adapter with Rust tests.

## Current Completion Status

- Phase 0: complete, with contract-scope drift in the pinned snapshot.
- Phase 1: complete for connectivity and evaluation lifecycle.
- Phase 2: not implemented in the desktop runtime beyond contract placeholders.
- Phase 3: not implemented.
- Phase 4: partial; mode selection exists, but companion lifecycle, auth, and
  version checks do not.
- Phase 5: not implemented beyond narrow config persistence.

See [backlog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/backlog.md)
for the validated phase audit and merged remediation backlog.

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

- Upstream source of truth: backend repo serves `/openapi.json`.
- Pinned local snapshot:
  [contracts/backend-api.openapi.json](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/contracts/backend-api.openapi.json)
- The current snapshot is broader than the implemented desktop runtime. It
  already includes Phase 2 and Phase 3 routes, so it should be treated as a
  forward-looking compatibility fixture, not a strict Phase 1-only snapshot.

## Out Of Scope

- Python sidecar orchestration from Tauri.
- MCP, agent-card, or AI-framed desktop UX.
- Local semantic search, embeddings, or LadyBugDB features.
- Desktop-authoritative historical run storage.

## Local Defaults

- Default local backend target: `http://127.0.0.1:8000`
- Frontend dev server: `http://localhost:1420`
- Desktop bundling: currently disabled pending later-phase release hardening

## Developer Docs

- Repo map: [codemap.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/codemap.md)
- CLI and test commands:
  [readme-CLI.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/readme-CLI.md)
- Change log:
  [changelog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/changelog.md)
