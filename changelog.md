# Changelog

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
- Refreshed `README.md`, `architecture.md`, `readme-CLI.md`, `backlog.md`,
  `implementation-roadmap.md`, `plan-review-traceability.md`, `AGENTS.md`, and
  codemap files to reflect current runtime behavior.

### Governance Docs

- Added `contributing.md`.
- Added `security-policy.md`.
- Added `bill-of-materials.md`.

### Release Notes

- This change set is primarily repository-truth and release-operability work.
- Runtime features were already present; the work here makes the completion
  ledger, packaging lane, and release documentation honest.
