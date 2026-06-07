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
- `docs/roadmap/README.md`: roadmap index and future-state document hub.
- `docs/roadmap/backlog.md`: authoritative completion tracker and merged
  remediation plan.
- `docs/roadmap/implementation-roadmap.md`: historical phase ledger and
  completion record.
- `docs/roadmap/plan-review-traceability.md`: review findings and roadmap
  mapping.
- `docs/roadmap/playwright-test-suite.md`: browser validation guide and test
  surface.
- `changelog.md`: release notes and documentation history.
- `shared-axioms.md`: cross-repo boundary ownership and validation axioms.
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
| `./` | Repo truth docs, release gates, contract snapshot, and atlas tracking | [codemap.md](codemap.md) |
| `docs/roadmap/` | Future-state planning, review, and execution records | roadmap index and phase ledger |
| `src/` | React operator shell and workflow UI | [src/codemap.md](src/codemap.md) |
| `src/lib/` | Frontend adapter seam to Tauri commands | [src/lib/codemap.md](src/lib/codemap.md) |
| `src-tauri/` | Packaged Tauri app, build metadata, and packaging config | [src-tauri/codemap.md](src-tauri/codemap.md) |
| `src-tauri/src/` | Rust transport/runtime boundary and IPC tests | [src-tauri/src/codemap.md](src-tauri/src/codemap.md) |
| `src-tauri/src/commands/` | Tauri command entry points and mode dispatch | [src-tauri/src/commands/codemap.md](src-tauri/src/commands/codemap.md) |
| `src-tauri/src/domain/` | Runtime domain models and snapshot persistence helpers | [src-tauri/src/domain/codemap.md](src-tauri/src/domain/codemap.md) |
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
8. Recon transport exists in the adapter/runtime, and the React shell wires an
   operator workflow around it.
9. Release validation checks contract sync, backend tests, desktop tests, Rust
   tests, frontend build, Playwright smoke, and Tauri package build.

## Current Completion Status

- Phases `0`, `1`, `2`, `3`, and `4`: complete and validated.
- Phase `5`: complete on this checkout, including `pnpm run validate:release`
  with package build and deterministic shell readiness.
- Checkpoint `6`: `R7-C4` snapshot persistence moved to `src-tauri/src/domain`,
  with command wiring kept in `src-tauri/src/commands`.

## Integration

- Backend worktree validated against this repo:
  `/private/tmp/stealth-lightbeacon-phase-0a-0b`
- Canonical desktop contract snapshot:
  `contracts/backend-api.openapi.json`
- Primary truth docs:
  - `README.md`
  - `readme.md`
  - `architecture.md`
  - `docs/roadmap/backlog.md`
  - `docs/roadmap/implementation-roadmap.md`
  - `docs/roadmap/plan-review-traceability.md`
  - `docs/roadmap/README.md`
  - `docs/roadmap/playwright-test-suite.md`
  - `readme-CLI.md`
