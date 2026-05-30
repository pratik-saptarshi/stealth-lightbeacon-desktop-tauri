# R6 Adversarial UX Contract TDD Plan

Last updated: 2026-05-30
Owner: desktop implementer
Scope: harden report-download UX contract and regression safety for adversarial findings OA-APP-01..04.

## Objective

1. Guarantee one report-download surface (Reports tab only).
2. Guarantee Reports download actions use artifact-backed links.
3. Prevent duplicate report-download rendering and stale contract regressions.
4. Keep roadmap truth docs synchronized with implemented shell behavior.

## In-Scope Findings

| Finding | Priority | Concern |
| --- | --- | --- |
| OA-APP-01 / R5-F01 | P1 | Reports table actions must be artifact-backed and actionable. |
| OA-APP-02 / R5-F02 | P1 | Results tab must not duplicate formatted report downloads. |
| OA-APP-03 / R5-F03 | P2 | Docs must match current tab and report UX contracts. |
| OA-APP-04 / R5-F04 | P2 | Tests must assert no duplicate surfaces and correct link semantics. |

## TDD Execution Model

Each work package must follow strict RED -> GREEN -> REFACTOR:

1. RED
   - Add/modify one failing test for one behavior.
   - Run focused test command and confirm failure reason is expected.
2. GREEN
   - Apply minimal production change to satisfy the failing assertion.
   - Re-run focused test and verify pass.
3. REFACTOR
   - Clean naming/helpers only if behavior unchanged.
   - Re-run focused tests and impacted suite.

No production changes are allowed before observing RED failure.

## Work Packages

### WP1 (P1): Single Report-Download Surface

- RED tests:
  - Results tab does not render "Formatted Reports" block.
  - Reports tab still renders report download table.
- GREEN implementation:
  - Remove Results duplicate download surface.
  - Keep reporting/artifacts content in Results unchanged.
- REFACTOR:
  - Remove dead state/helpers tied to removed UI block.

Validation:
- `pnpm test -- src/__tests__/app-shell.test.tsx -t "renders terminal success results after polling completes"`

### WP2 (P1): Artifact-Backed Reports Actions

- RED tests:
  - Reports download actions use artifact URLs (non-`data:`).
  - Duplicate artifacts do not produce duplicate rows.
- GREEN implementation:
  - Derive Reports-table rows from artifacts with `downloadUrl`.
  - Deduplicate rows by stable key (artifact name + URL).
- REFACTOR:
  - Consolidate row mapping helper and key-generation logic.

Validation:
- `pnpm test -- src/__tests__/app-shell.test.tsx -t "collapses trace and reporting panels on demand"`

### WP3 (P2): Adversarial Regression Assertions

- RED tests:
  - Snapshot-restore and artifact metadata tests tolerate table rendering without ambiguity.
  - Download-table link semantics validated with precise selectors.
- GREEN implementation:
  - Tighten test selectors and expectations for deterministic intent.
- REFACTOR:
  - Reuse table query helpers in app-shell tests where repeated.

Validation:
- `pnpm test -- src/__tests__/app-shell.test.tsx`

### WP4 (P2): Roadmap Contract Alignment

- RED checks (doc contract drift):
  - Validate tab/report contract note does not reference legacy tab topology.
  - Validate roadmap points to Reports table as single download surface.
- GREEN implementation:
  - Update roadmap docs and traceability entries.
- REFACTOR:
  - Keep cross-doc wording aligned (backlog, traceability, contract note).

Validation:
- Manual doc consistency check across:
  - `docs/roadmap/backlog.md`
  - `docs/roadmap/plan-review-traceability.md`
  - `docs/roadmap/tab-shell-navigation-and-report-downloads.md`

## Mandatory Checkpoints

### Checkpoint A (after WP1+WP2 code changes)

- Run focused tests for WP1/WP2.
- Request code review using `requesting-code-review` skill before merging further changes.

### Checkpoint B (after WP3 code changes)

- Run full shell test file.
- Request second code review to verify no regression in adjacent report/trace behavior.

### Checkpoint C (final pre-merge)

- Run consolidated validations:
  - `pnpm test -- src/__tests__/app-shell.test.tsx`
  - targeted rust/adapter tests only if touched.
- Request final code review for branch delta before merge/commit to main.

## Beads Mapping

- Epic: R6 adversarial UX contract hardening.
- Child tasks:
  - T1 WP1 single-surface enforcement.
  - T2 WP2 artifact-backed link enforcement.
  - T3 WP3 adversarial test hardening.
  - T4 WP4 roadmap contract synchronization.
  - T5 checkpoint code reviews and closure.

## Exit Criteria

1. No Results-tab duplicate download surface.
2. Reports download actions are artifact-backed and deduplicated.
3. App-shell tests pass with explicit coverage for both behaviors.
4. Roadmap/traceability docs align with implemented shell contract.
5. Code review checkpoints completed after code changes.
