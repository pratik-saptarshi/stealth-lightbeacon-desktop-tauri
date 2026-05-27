# Changelog

## 2026-05-27

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
