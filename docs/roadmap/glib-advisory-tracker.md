# glib Advisory Tracker

This note tracks GHSA-wrw7-89jp-8q8g / RUSTSEC-2024-0429 for the GTK/WebKit
dependency chain used by Tauri on Linux.

## Current State

- `Cargo.lock` still carries `glib 0.18.5`.
- The dependency tree continues through `tauri v2.11.2` and `wry v0.55.1`.
- The validated release lane still passes end to end in this checkout.

## Upstream Evidence

- The current `tauri-apps/wry` releases page still shows the GTK3 stack with
  `glib 0.18.5` in the advisory output.
- The current `tauri-apps/tauri` releases page does not advertise a compatible
  `glib >= 0.20.0` chain in the release notes checked for this task.

## Monitoring Rule

- monitor upstream Tauri, Wry, and GTK releases.
- Attempt a dependency bump only when a compatible chain resolves
  `glib >= 0.20.0`.
- Revalidate with `cargo tree`, Rust tests, and `pnpm run check` after any
  dependency move.
- keep the advisory issue open until the upstream chain changes.
