# Tech Stack

## Desktop shell

- `Tauri v2`
- `Rust`
- `React + Vite + TypeScript`

## Desktop boundary

- `serde` and `serde_json` for request and response models
- `reqwest` for backend HTTP transport
- app-config JSON persistence under the Tauri app config directory

## Testing

- `cargo test` for Rust adapter and config tests
- `Vitest + Testing Library` for UI state coverage
- `unittest` for pinned OpenAPI snapshot checks

## Non-goals for the desktop MVP

- embedded Python runtime
- local DB or vector index
- MCP plugins or agent protocols

## Toolchain pin

- Node.js `26.13.1` (`.nvmrc`, `package.json#engines.node`).
- pnpm `10.12.4` for the Tauri v2 desktop build. The sibling lightbeacon repos use `11.4.0`; aligning this repo is a follow-up so the desktop toolchain is not changed in the Node security patch.
