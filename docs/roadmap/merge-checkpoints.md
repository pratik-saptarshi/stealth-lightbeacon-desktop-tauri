# Merge Checkpoints

## Current Branch Merge Plan

- Branch: feat/phase5-tdd
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
