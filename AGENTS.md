# Agent Guide

## Start Here

- Read [codemap.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/codemap.md).
- Use the folder codemaps under `src/`, `src/lib/`, `src-tauri/`, and
  `src-tauri/src/` before making structural changes.
- Treat [backlog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/backlog.md)
  as the current completion tracker and remediation backlog.

## Repo Rules

- This repo is an API-first desktop client, not a Python sidecar host.
- React must stay behind the desktop adapter in `src/lib/desktop.ts`.
- Rust in `src-tauri/src/` is the trusted boundary for config persistence,
  validation, and HTTP transport.
- The backend contract source of truth lives upstream in the backend repo; this
  repo pins a local snapshot at `contracts/backend-api.openapi.json`.

## Current Phase Reality

- Phase 0 and Phase 1 are implemented.
- Phase 2, Phase 4, and Phase 5 remain partial or not started.
- Review findings in `backlog.md` call out Phase 1 follow-up defects that should
  be treated as active work even though the Phase 1 path is functional.
