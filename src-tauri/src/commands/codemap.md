# src-tauri/src/commands/

## Responsibility

This folder owns the Tauri command surface for the desktop runtime. It maps each
`#[tauri::command]` to concrete domain behavior in `crate::domain` and
`crate::` utility functions.

## Design

- **Boundary pattern**: thin command orchestration layer delegating policy and I/O to
  domain/adapter helpers.
- **Mode dispatch**: command handlers branch on `BackendMode` (`Standalone`,
  `Local`, `Remote`) and route behavior accordingly.
- **Separation of concerns**: no persistence/network transport decisions are made
  here beyond mode selection and typed argument validation.

## Flow

1. Frontend invokes a command via `@tauri-apps/api` (through
   `src/lib/desktop.ts`).
2. Handler reads current `AppState`.
3. Standalone mode branches into local in-memory evaluation and recon code paths.
4. Local/remote modes resolve effective transport config through `effective_backend_config_from_app_state(...)`.
5. Handler delegates to:
   - HTTP adapter helpers for `/health`, `/capabilities`, evaluation CRUD, artifacts,
     and recon.
   - `crate::save_last_opened_snapshot` / `load_last_opened_snapshot` for persistence.

## Integration

- Consumed by: `src-tauri/src/lib.rs` via `commands::` module re-export.
- Depends on: `crate::domain` model types and in-tree adapter helpers in
  `src-tauri/src/lib.rs`.
- Invoked by: `src/lib/desktop.ts` command wrappers.
