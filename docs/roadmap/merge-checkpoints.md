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
