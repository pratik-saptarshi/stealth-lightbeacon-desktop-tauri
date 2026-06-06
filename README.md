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
- Phase `5` is complete for package-grade release validation on the desktop
  repository, including Tauri bundle construction and the local shell readiness
  path used by release checks.
- Linux packaging currently inherits GitHub advisory
  `GHSA-wrw7-89jp-8q8g` / `RUSTSEC-2024-0429` through the Tauri GTK/WebKit
  dependency chain (`glib 0.18.5`, patched in `glib >=0.20.0`). This is an
  accepted upstream dependency risk tracked in Beads as
  `stealth-lightbeacon-desktop-tauri-kh8`; do not force a local `glib`
  override unless the Tauri/Wry/GTK chain supports it. Remediation should
  upgrade Tauri/Wry when a compatible release resolves the GTK-RS chain, then
  verify `cargo tree --target all -i glib`, Rust tests, and `pnpm run check`.

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
