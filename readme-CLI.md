# CLI And Local Commands

This repo is a desktop app, not an operator CLI product. The commands below are
for local development, validation, and release work.

## Common Commands

- `npm run dev`
  Starts the Vite frontend dev server.
- `npm run tauri:dev`
  Starts the full desktop app in local development mode.
- `npm run build`
  Builds the frontend bundle into `dist/`.
- `npm run preview`
  Serves the built frontend bundle locally.
- `npm run check`
  Runs the full validation lane: lint, coverage, browser smoke, Python contract
  tests, and Rust tests.
- `npm run test`
  Runs the React and adapter-facing Vitest suite.
- `npm run test:coverage`
  Runs the shell coverage lane with the enforced Vitest thresholds.
- `npm run test:e2e`
  Runs the Playwright browser smoke for the tabbed shell and workspace presets.
- `npm run test:python`
  Runs the pinned OpenAPI contract checks in `tests/contracts/`.
- `npm run test:rust`
  Runs the Rust adapter tests under `src-tauri/`.
- `cargo test --manifest-path src-tauri/Cargo.toml`
  Direct Rust test entrypoint when isolating the desktop transport layer.
- `npm run check:contract-sync`
  Regenerates the backend OpenAPI contract from the sibling backend repo and
  fails if the pinned desktop copy drifts.
- `npm run validate:release`
  Runs the cross-repo release lane: contract sync, backend tests, desktop
  contract tests, Vitest, Rust tests, frontend build, and Tauri package build.
- `npm run tauri:build`
  Produces the macOS `.app` bundle through Tauri.
- `git tag -a <tag> -m "<message>"`
  Creates the release tag after validation passes.
- `git push origin <tag>`
  Publishes the GitHub release by triggering the tag-based release workflow.
- `gh release view <tag>`
  Verifies the published release page and notes when CLI auth is available.

## Repo Truth Files

- `contracts/backend-api.openapi.json`
  Pinned backend API snapshot used by local contract tests.
- `readme.md`
  Lowercase companion to `README.md` for tools that expect normalized file
  names.
- `docs/roadmap/README.md`
  Roadmap index for the moved planning and review documents.
- `docs/roadmap/backlog.md`
  Verified completion tracker and merged remediation backlog.
- `docs/roadmap/implementation-roadmap.md`
  Historical phase sequence plus the verified partial-vs-complete ledger.
- `docs/roadmap/plan-review-traceability.md`
  Review findings and how they mapped into implementation/remediation work.
- `codemap.md`
  Repository atlas for the current desktop shell, runtime, and release surface.

## External Dependencies

- Backend repo: `/Volumes/dev/Git-SCM/stealth-lightbeacon`
- Validated backend worktree:
  `/private/tmp/stealth-lightbeacon-phase-0a-0b`
- Default local backend base URL: `http://127.0.0.1:8000`
