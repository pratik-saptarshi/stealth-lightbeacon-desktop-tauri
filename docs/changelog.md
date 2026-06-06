# Changelog

## 2026-06-06

### Phase-5 Merge Progress

- Added checkpoint merge tracking for progressive `feat/phase5-tdd` integration into
  `main`.
- Completed Phase-5 checkpoint 1:
  - validation scripts migrated to pnpm parity, and contract/python checks ran.
- Completed Phase-5 checkpoint 2:
  - workspace polling/re-render determinism tests were stabilized.
- Completed Phase-5 checkpoint 3:
  - merge queue revalidation confirmed no additional feature branches/worktrees pending
    for mainline merge at this date.
- Completed Phase-5 checkpoint 4:
  - TypeScript and Rust release validation blockers were removed, including API type import cleanup, shell smoke stability fixes, and Playwright fixture migration.
- Completed end-to-end package-grade release validation via:
  - `pnpm run validate:release` (including Tauri package build).

### Validation Evidence

- `pnpm run validate:release`
- `python3 scripts/check_contract_sync.py`
- `python3 -m unittest discover -s tests/contracts -p "test_*.py"`
- `pnpm run test -- --run src/lib/desktop.test.ts src/__tests__/app-shell.test.tsx`
- `pnpm exec playwright test` (browser-smoke and a11y scenarios)

### Current Roadmap Completion

- Phases 0, 1, 2, 3, and 4 are complete.
- `R5` validation tasks completed in this checkpoint with full release gating on
  the local branch.
- `R3` now includes Tauri package build execution as part of release validation,
  and the blocker for deterministic `validate:release` completion has been resolved.

### Track Note

- Continue to keep `docs/roadmap/backlog.md`, `docs/roadmap/implementation-roadmap.md`,
  and `docs/roadmap/merge-checkpoints.md` aligned with commit history.
