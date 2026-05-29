# Changelog

## 2026-05-27

### Mainline Merge And Validation

- Merged the validated feature and validation worktrees into the mainline
  desktop branch.
- Consolidated the remaining planning and product-management records under
  `docs/roadmap/`.
- Kept the shell, recon workflow, and operator-policy surfaces documented
  against the merged code.
- Preserved the Playwright browser smoke, Vitest coverage lane, and release
  validation workflow as the current testing and governance surface.

### Responsive Operator Shell

- Added viewport detection in the desktop shell so the UI can classify compact,
  balanced, and wide layouts.
- Set the first-launch Tauri window size to `800 x 600` so the app opens in a
  compact but usable default workspace.
- Reworked the main workspace into horizontal tabs below the header so only the
  active panel stays visible.
- Kept the terminal reporting and artifact loading flow stable after the tabbed
  shell refactor.

### Public Release Refresh

- Updated the public status docs to match the current viewport-aware shell and
  the tabbed operator layout.
- Refreshed the repository atlas and folder codemaps to describe the current UI
  and runtime boundaries.
- Published the current documented GitHub release for this iteration through
  the tag-push workflow.

## 2026-05-29

### UI And Workflow

- Added keyboard-accessible workspace tab navigation with arrow/home/end support.
- Added recon preflight workflow in the audit panel, including capability gating,
  execution status, and result rendering.
- Added report-format selection and one-click download trigger for JSON, Markdown,
  and HTML terminal outputs.
- Added remote auth and compatibility policy guidance cards in the connection panel.

### Adapter And Type Hardening

- Split desktop adapter types into `src/lib/desktop.types.ts` and app view types
  into `src/App.types.ts` for clearer ownership.
- Normalized recon responses in the desktop adapter to guard against malformed
  backend payloads before rendering.
- Extended helper coverage for report rendering, viewport defaults, version
  comparisons, request validation branches, and policy guidance.

### Validation And Release Lane

- Added shell validation lanes:
  - frontend coverage gate
  - browser smoke checks
  - axe-core accessibility checks
- Updated release validation to run `validate:shell` before contract and backend
  checks.
- Synced pinned desktop contract to backend source of truth:
  `/Volumes/dev/Git-SCM/stealth-lightbeacon/contracts/backend-api.openapi.json`.
- Updated contract-sync and contract tests to validate the current backend
  contract format and release lane behavior.

## 2026-05-26

### Verified Completion

- Revalidated the original phased roadmap against the implemented desktop repo
  and the backend companion worktree.
- Confirmed the backend substrate phases `0A` through `5` are implemented across
  desktop and backend.
- Corrected the desktop truth docs to distinguish completed substrate work from
  remaining operator-facing recon and remote-policy UX work.

### Release Hardening

- Fixed the desktop release validator to exercise the actual Tauri package
  boundary instead of stopping at the web bundle, using the macOS `.app`
  artifact path instead of a failing DMG-only path.
- Activated Tauri bundling in `src-tauri/tauri.conf.json`.
- Refreshed `README.md`, `readme.md`, `architecture.md`, `readme-CLI.md`,
  `docs/roadmap/backlog.md`, `docs/roadmap/implementation-roadmap.md`,
  `docs/roadmap/plan-review-traceability.md`, and codemap files to reflect
  current runtime behavior.

### Governance Docs

- Added `contributing.md`.
- Added `security-policy.md`.
- Added `bill-of-materials.md`.

### Release Notes

- This change set is primarily repository-truth and release-operability work.
- Runtime features were already present; the work here makes the completion
  ledger, packaging lane, and release documentation honest.
