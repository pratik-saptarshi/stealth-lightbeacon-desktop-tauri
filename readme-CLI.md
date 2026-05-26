# CLI And Local Commands

This repo is a desktop app, not an operator CLI product. The commands below are
for local development, validation, and packaging work inside the repository.

## Frontend

- `npm run dev`
  Starts the Vite frontend dev server.
- `npm run build`
  Builds the frontend bundle into `dist/`.
- `npm run preview`
  Serves the built frontend bundle locally.

## Validation

- `npm run test`
  Runs the React and adapter-facing Vitest suite.
- `npm run test:python`
  Runs the pinned OpenAPI contract checks in `tests/contracts/`.
- `npm run test:rust`
  Runs the Rust adapter tests under `src-tauri/`.
- `npm run check`
  Runs lint plus all test suites.

## Tauri

- `cargo test --manifest-path src-tauri/Cargo.toml`
  Direct Rust test entrypoint when isolating the desktop transport layer.
- `npm run tauri dev`
  Standard Tauri local app run, using the frontend dev server and Rust backend.

## Contract And Roadmap Files

- `contracts/backend-api.openapi.json`
  Pinned backend API snapshot used by local contract tests.
- `backlog.md`
  Validated completion tracker and merged remediation backlog.
- `implementation-roadmap.md`
  Original implementation sequence retained for historical phase intent.

## Notes

- The real backend API repo is `/Volumes/dev/Git-SCM/stealth-lightbeacon`.
- The default local backend base URL is `http://127.0.0.1:8000`.
- Desktop bundling is still disabled in `src-tauri/tauri.conf.json`, so release
  packaging work remains a backlog item.
