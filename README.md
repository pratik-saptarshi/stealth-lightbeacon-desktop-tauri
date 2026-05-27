# Stealth Lightbeacon Desktop Client

![Stealth Lightbeacon desktop client](./src/assets/hero.png)

Canonical landing page for the desktop client. Some handoff instructions refer
to a lowercase `readme.md`; this worktree is case-insensitive, so the same file
path serves both references here.

## What This Repo Owns

- local backend configuration persistence
- trusted Rust-side transport and validation
- local companion startup and shutdown in `local` mode
- remote transport policy and auth-token lookup in `remote` mode
- operator workflow for submission, polling, results, artifacts, recon, and
  last-opened snapshot restore
- viewport-aware tabbed shell layout with compact-first defaults and active
  panel visibility gating

## Current Reality

- The shell is tabbed and density-aware, with horizontal tabs below the header
  and only the selected panel visible at a time.
- The first desktop launch opens at `800 x 600`, which keeps the default
  workspace compact and scroll-light.
- Phases `0`, `1`, `2`, `3`, and `4` are complete and validated.
- Phase `5` is partial because release validation and packaging still depend on
  deterministic backend readiness and environment-specific Tauri packaging
  checks, even though publication is documented through the tag-push workflow
  and GitHub Actions.

## Where To Look

- [README.md](README.md)
- [codemap.md](codemap.md)
- [Roadmap index](./docs/roadmap/README.md)
- [Backlog](./docs/roadmap/backlog.md)
- [Implementation roadmap](./docs/roadmap/implementation-roadmap.md)
- [Plan review traceability](./docs/roadmap/plan-review-traceability.md)
- [Playwright test suite](./docs/roadmap/playwright-test-suite.md)
- [shared-axioms.md](shared-axioms.md)
- [architecture.md](architecture.md)
- [readme-CLI.md](readme-CLI.md)
- [changelog.md](changelog.md)
- [contributing.md](contributing.md)
- [security-policy.md](security-policy.md)
- [bill-of-materials.md](bill-of-materials.md)
