# Repository Atlas: stealth-lightbeacon-desktop-tauri

## Project Responsibility

This repository is the Tauri desktop client for Stealth Lightbeacon. It owns
desktop-local state, trusted transport behavior, local companion lifecycle,
operator UX, release validation, and the published desktop packaging boundary.
The sibling backend repo remains authoritative for evaluation state, results,
artifacts, recon output, and the canonical OpenAPI contract.

## System Entry Points

- `README.md`: canonical GitHub landing page for the desktop client.
- `readme.md`: lowercase mirror for tooling and handoff consistency.
- `codemap.md`: repository atlas and current architecture map.
- `backlog.md`: authoritative completion tracker and merged remediation plan.
- `implementation-roadmap.md`: historical phase ledger and completion record.
- `changelog.md`: release notes and documentation history.
- `scripts/check_contract_sync.py`: pinned contract drift gate.
- `scripts/release_validate.py`: cross-repo release validation gate.
- `.github/workflows/release.yml`: tag-push GitHub Actions release publisher.
- `src-tauri/tauri.conf.json`: desktop window defaults and packaging metadata.
- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: operator shell and workflow state.
- `src/lib/desktop.ts`: typed Tauri adapter boundary.
- `src-tauri/src/main.rs`: Rust bootstrap.
- `src-tauri/src/lib.rs`: trusted runtime, transport policy, and IPC surface.

## Directory Map

| Directory | Responsibility Summary | Detailed Map |
| --- | --- | --- |
| `./` | Repo truth docs, release gates, contract snapshot, and backlog tracking | [codemap.md](codemap.md) |
| `src/` | React operator shell and workflow UI | [src/codemap.md](src/codemap.md) |
| `src/lib/` | Frontend adapter seam to Tauri commands | [src/lib/codemap.md](src/lib/codemap.md) |
| `src-tauri/` | Packaged Tauri app, build metadata, and packaging config | [src-tauri/codemap.md](src-tauri/codemap.md) |
| `src-tauri/src/` | Rust transport/runtime boundary and IPC tests | [src-tauri/src/codemap.md](src-tauri/src/codemap.md) |
| `contracts/` | Pinned backend OpenAPI snapshot | contract assertions and sync target |
| `scripts/` | Drift sync and release validation automation | release gate helpers |
| `tests/` | Python contract checks and backend-facing fixtures | contract test suite |

## Runtime Topology

1. Tauri opens the desktop window at `800 x 600` by default and embeds the
   current frontend build.
2. React loads persisted backend config and snapshot state through Tauri.
3. The frontend classifies the viewport, switches the shell into compact or
   balanced density, and exposes the operator workflow through horizontal
   tabs.
4. Rust resolves `backend-config.json` and the last-opened terminal snapshot
   from the app config directory.
5. React refreshes `/health` and `/capabilities` and gates operator actions on
   capability data.
6. In local mode, Rust can auto-start the sibling backend companion and wait
   for readiness before requests proceed.
7. Submission flows through `POST /evaluations`, polling through
   `GET /evaluations/{evaluation_id}`, and terminal retrieval through result
   and artifact routes.
8. Recon transport exists in the adapter/runtime, but the operator workflow is
   still backlog work in `src/App.tsx`.
9. Release validation checks contract sync, backend tests, desktop tests, Rust
   tests, frontend build, and Tauri package build.

## Current Completion Status

- Phases `0`, `1`, and `2`: complete and validated.
- Phase `3`: partial, because recon transport exists but the React operator
  workflow is not yet wired.
- Phase `4`: partial, because local and remote runtime substrate exists but the
  operator-facing auth and compatibility UX is still thin.
- Phase `5`: partially complete, because contract sync and release validation
  exist and the release publication workflow is documented and exercised
  through the tag-push GitHub Actions path.

## Integration

- Backend worktree validated against this repo:
  `/private/tmp/stealth-lightbeacon-phase-0a-0b`
- Canonical desktop contract snapshot:
  `contracts/backend-api.openapi.json`
- Primary truth docs:
  - `README.md`
  - `readme.md`
  - `architecture.md`
  - `backlog.md`
  - `readme-CLI.md`
