# src-tauri/

## Responsibility

This tree contains the packaged Tauri application shell. It defines the Rust
desktop backend, build metadata, platform capabilities, generated schemas, and
window/runtime configuration used to ship the desktop client.

## Design

- `src/` holds the executable Rust backend. `main.rs` is a bootstrap shim and
  `lib.rs` currently contains the full runtime adapter.
- `tauri.conf.json` defines app identity, build hooks, window defaults, and the
  release packaging configuration.
- The default window size is `800 x 600`, which matches the compact-first
  desktop shell layout.
- `capabilities/default.json` contains the Tauri capability manifest.
- `gen/schemas/` contains generated configuration schemas for local reference.
- `Cargo.toml` keeps the Rust dependency surface narrow: `tauri`, `reqwest`,
  `serde`, `serde_json`, and `tokio`.

The production runtime is still consolidated inside `src/lib.rs`, but the tree
now carries the complete desktop boundary for local companion management,
transport policy, contract-aware IPC, and packaging validation.

## Flow

1. Tauri starts through `src/main.rs`.
2. `src/lib.rs` loads persisted backend config and initializes shared app
   state.
3. Tauri registers the desktop command surface used by the React UI.
4. Command handlers validate config and request payloads and proxy HTTP calls to
   the backend API.
5. Packaging settings in `tauri.conf.json` control how the built frontend is
   embedded and how the release bundle is produced.
6. The tabbed React shell adapts its density to the viewport while keeping
   inactive panels hidden.

## Integration

- Frontend integration: React calls only the registered Tauri commands.
- Filesystem integration: config persists under the app config directory rather
  than repo-local paths.
- Backend integration: all documented routes in the pinned contract are wired
  through the Rust adapter.
- Release integration: this tree is part of the release gate through
  `npm run tauri:build` and the cross-repo release validator.
