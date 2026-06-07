# Merge Checkpoints

## Current Branch Merge Plan

- Branch: phase5-release-validation
- Base: main
- Method: progressive checkpoint merges with validation after each step

## Checkpoints

### Merge Checkpoint 1 — pnpm Validation Parity
- Commit: 8a0ee7c
- Merge commit: 2f90129
- Scope: desktop validation/CLI parity
  - scripts/browser_smoke.mjs
  - scripts/validate_shell.mjs
  - scripts/release_validate.py
  - tests/contracts/test_release_validate_a11y.py
- Validation run:
  - python3 scripts/check_contract_sync.py
  - python3 -m unittest discover -s tests/contracts -p "test_*.py"
  - node ./node_modules/vitest/vitest.mjs run src/__tests__/app-shell.test.tsx
- Status: completed
- Tag: checkpoint/main-phase5-1-merge-1

### Merge Checkpoint 2 — Polling Determinism & Panel UX
- Commit: fb16751
- Merge commit: bb192ba
- Scope: src/__tests__/app-shell.test.tsx determinism and polling assertions
- Validation run:
  - python3 scripts/check_contract_sync.py
  - python3 -m unittest discover -s tests/contracts -p "test_*.py"
  - node ./node_modules/vitest/vitest.mjs run src/__tests__/*.test.ts src/__tests__/*.tsx
- Status: completed
- Tag: checkpoint/main-phase5-2-merge-2

### Merge Checkpoint 3 — Merge Queue Revalidation
- Branch candidates checked:
  - local: feat/phase5-tdd, main
  - remote: origin/main only
- Decision: no additional merge-ready worktrees/features detected on 2026-06-06.
- Scope: merge orchestration only
- Validation run:
  - python3 scripts/check_contract_sync.py
  - python3 -m unittest discover -s tests/contracts -p "test_*.py"
  - node ./node_modules/vitest/vitest.mjs run src/__tests__/*.test.ts src/__tests__/*.tsx
- Status: complete
- Tag: checkpoint/main-phase5-3-queue-clean

### Merge Checkpoint 4 — Release Validation Unblocking
- Commit: c79b973
- Merge commit: c539add
- Scope: type-only import cleanup, deterministic smoke fixture migration, and Tauri release-lane hardening
- Validation run:
  - python3 scripts/check_contract_sync.py
  - python3 -m unittest discover -s tests/contracts -p "test_*.py"
  - pnpm run test:coverage:frontend
  - pnpm exec playwright test
  - pnpm run test:python
  - pnpm run test:rust
  - pnpm run validate:release
- Status: completed
- Tag: checkpoint/main-phase5-4-release-validation

### Merge Checkpoint 5 — Companion Readiness Backoff
- Branch: feat/r7-local-backoff
- Base: main
- Scope: local companion readiness polling stability
- Code changes:
  - `src-tauri/src/lib.rs`
    - introduce `companion_health_retry_delay_ms`
    - switch `wait_for_local_backend_health` to exponential backoff (100→1600ms cap)
- Test coverage:
  - `cargo test --lib tests::companion_health_retry_delay_is_exponential_with_cap -- --exact`
- Validation status:
  - test passes (1/1 in scope)
  - existing full Rust suite remains environment-constrained (listener `Operation not permitted` on local fixture binding)
- Tag: checkpoint/main-r7-local-backoff-1

### Merge Checkpoint 6 — R7-C4 Snapshot Domain Extraction
- Branch: feat/r7-c4-commands-modularization
- Base: main
- Scope: move last-opened snapshot persistence validation/load/save helpers into
  `src-tauri/src/domain/snapshot.rs` and keep `lib.rs` command wiring thin

  - `src-tauri/src/domain/snapshot.rs` (new):
    - `validate_last_opened_snapshot`
    - `load_last_opened_snapshot_from`
    - `save_last_opened_snapshot_to`
  - `src-tauri/src/lib.rs`:
    - delegate snapshot persistence helpers to domain module
    - retain path resolution wrappers used by command handlers

- Validation status:
  - `cargo test domain::snapshot::tests::validate_snapshot_rejects_non_terminal_status -- --exact` (pass)
  - `cargo test domain::snapshot::tests::validate_snapshot_rejects_artifacts_with_empty_media_type -- --exact` (pass)
  - `cargo test tests::last_opened_snapshot_round_trips_on_disk -- --exact` (pass)
  - broader `cargo test --lib` remains environment-constrained (`Operation not permitted` on listener bind for network-heavy suite)
