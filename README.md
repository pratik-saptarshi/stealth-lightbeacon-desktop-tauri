# Stealth Lightbeacon Desktop Client

This repository is the Tauri desktop client for Stealth Lightbeacon. The audit
engine, companion HTTP API, and canonical OpenAPI contract live in the sibling
backend worktree at `/private/tmp/stealth-lightbeacon-phase-0a-0b` and the
source repository path `/Volumes/dev/Git-SCM/stealth-lightbeacon`.

The desktop repo owns:

- local backend configuration persistence
- trusted Rust-side HTTP transport and validation
- local companion startup and shutdown in `local` mode
- remote transport policy and auth-token lookup in `remote` mode
- operator workflow for submission, polling, results, artifacts, recon, and
  last-opened snapshot restore

## Implemented Surface

- `GET /health`
- `GET /capabilities`
- `POST /evaluations`
- `GET /evaluations/{evaluation_id}`
- `GET /evaluations/{evaluation_id}/result`
- `GET /evaluations/{evaluation_id}/artifacts`
- `POST /recon`

Desktop behavior implemented against that surface:

- persist backend mode, base URL, and timeout in Tauri app config
- validate connectivity and capabilities before operator actions
- submit evaluations and poll to terminal completion
- retrieve terminal results and artifact descriptors
- auto-start and stop a managed local companion
- enforce remote `https://` policy plus Rust-only bearer-token lookup through
  `STEALTH_LIGHTBEACON_REMOTE_AUTH_TOKEN`
- persist and restore the last-opened terminal snapshot
- validate contract sync and cross-repo release readiness
- keep recon transport support behind the desktop adapter pending operator UI
  wiring

## Completion Ledger

The desktop and backend substrate work solved the original critical path, but
the operator-facing completion ledger is more nuanced:

- Phase `0`, `1`, and `2`: complete
- Phase `3`: partial because recon transport exists but the React workflow is
  not yet wired
- Phase `4`: partial because the local/remote runtime substrate exists but the
  operator-facing auth and compatibility UX still needs work
- Phase `5`: partial because local validation is strong but GitHub publication
  plumbing is still missing in this checkout

See:

- [backlog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/backlog.md)
  for the verified completion ledger and remaining remediation backlog
- [desktop-backend-contract.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/desktop-backend-contract.md)
  for the cross-repo contract map
- [architecture.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/architecture.md)
  for transport and trust boundaries

## Contract Boundary

- Backend source of truth: sibling backend serves `/openapi.json` and exports
  `contracts/backend-api.openapi.json`
- Pinned desktop snapshot:
  [contracts/backend-api.openapi.json](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/contracts/backend-api.openapi.json)
- Drift gate: `npm run check:contract-sync`

## Release Boundary

- Local mode requires a sibling backend checkout or compatible companion
  runtime on the same machine.
- Remote mode requires `https://`.
- The desktop package does not embed a Python runtime; the companion remains a
  separately versioned backend deliverable.
- Default local backend target: `http://127.0.0.1:8000`
- Frontend dev server: `http://localhost:1420`
- Cross-repo validation lane: `npm run validate:release`
- Tauri package build (`.app` bundle): `npm run tauri:build`

## Repo Map

- [codemap.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/codemap.md)
- [readme-CLI.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/readme-CLI.md)
- [changelog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/changelog.md)
- [contributing.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/contributing.md)
- [security-policy.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/security-policy.md)
- [bill-of-materials.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/bill-of-materials.md)
