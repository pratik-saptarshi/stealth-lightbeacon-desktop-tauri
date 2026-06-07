# src-tauri/src/domain/

## Responsibility

This folder contains the shared domain model and pure-domain helpers used by the
Tauri runtime. It centralizes serialization schemas, validation helpers, and
snapshot persistence primitives so `lib.rs` can stay command-focused.

## Design

- **Domain module split**: core DTOs and validation rules live in `mod.rs`;
  snapshot persistence is moved into dedicated `snapshot.rs`.
- **Validation boundary**: snapshot validation ensures consistency of IDs, terminal
  completion state, and artifact metadata shape before persistence.
- **File I/O seam**: snapshot load/save helpers own read/parse/write error mapping
  and call `validate_last_opened_snapshot` before returning/writing data.

## Flow

1. `lib.rs` resolves snapshot path and calls `load_last_opened_snapshot_from(...)`
   / `save_last_opened_snapshot_to(...)`.
2. `load_*` reads JSON from disk if present, validates structure, and returns an
   optional typed `LastOpenedSnapshot`.
3. `save_*` validates first, creates parent directories, serializes pretty JSON,
   and persists to disk.
4. Command handlers persist only terminal-complete snapshots required for resume UX.

## Integration

- Imported by: `src-tauri/src/lib.rs` and `src-tauri/src/commands/mod.rs`.
- Re-exports: `load_last_opened_snapshot_from`, `save_last_opened_snapshot_to`,
  shared DTOs, and domain errors.
- Contract touchpoints: last-opened snapshot behavior in runtime tests and
  frontend resume flow.
