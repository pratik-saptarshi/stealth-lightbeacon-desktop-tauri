# src-tauri/

## Responsibility

This tree contains the packaged Tauri application shell. It defines the Rust
desktop backend, build metadata, platform capabilities, generated schemas, and
window/runtime configuration used to ship the desktop client.

## Design

- `src/` holds the executable Rust backend. `main.rs` is a bootstrap shim and
  `lib.rs` currently contains the full runtime adapter.
- `tauri.conf.json` defines app identity, build hooks, window defaults, and the
  current non-bundled packaging state.
- `capabilities/default.json` contains the Tauri capability manifest.
- `gen/schemas/` contains generated configuration schemas for local reference.
- `Cargo.toml` keeps the Rust dependency surface narrow: `tauri`, `reqwest`,
  `serde`, `serde_json`, and `tokio`.

The folder is still early-stage. `src/commands/` and `src/domain/` exist as
future decomposition points, but the production runtime is still consolidated
inside `src/lib.rs`.

## Flow

1. Tauri starts through `src/main.rs`.
2. `src/lib.rs` loads persisted backend config and initializes shared app
   state.
3. Tauri registers the desktop command surface used by the React UI.
4. Command handlers validate config/request payloads and proxy HTTP calls to the
   backend API.
5. Packaging settings in `tauri.conf.json` control how the built frontend is
   embedded and whether release bundling is active.

## Integration

- Frontend integration: React calls only the registered Tauri commands.
- Filesystem integration: config persists under the app config directory rather
  than repo-local paths.
- Backend integration: Phase 1 routes are live; Phase 2+ routes are contract
  placeholders until wired.
- Release integration: bundling is still disabled, which matches the backlog's
  Phase 5 hardening status.
