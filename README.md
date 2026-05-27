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
- Phases `0`, `1`, and `2` are complete and validated.
- Phase `3` is partial because recon transport exists, but the React workflow
  is not yet wired.
- Phase `4` is partial because the local/remote runtime substrate exists, but
  operator-facing auth and compatibility UX is still thin.
- Phase `5` is partial because validation and packaging exist, and GitHub
  publication is handled through the documented tag-push workflow and GitHub
  Actions rather than an automated in-app path.

## Where To Look

- [README.md](README.md)
- [codemap.md](codemap.md)
- [Roadmap index](./docs/roadmap/README.md)
- [Backlog](./docs/roadmap/backlog.md)
- [Implementation roadmap](./docs/roadmap/implementation-roadmap.md)
- [Plan review traceability](./docs/roadmap/plan-review-traceability.md)
- [shared-axioms.md](shared-axioms.md)
- [architecture.md](architecture.md)
- [readme-CLI.md](readme-CLI.md)
- [changelog.md](changelog.md)
- [contributing.md](contributing.md)
- [security-policy.md](security-policy.md)
- [bill-of-materials.md](bill-of-materials.md)
