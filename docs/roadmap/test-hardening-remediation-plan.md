# Test Hardening Remediation Plan (Unit + Integration + Playwright)

Last updated: 2026-05-29
Owner: desktop implementer
Scope: harden all three test layers (unit, integration, Playwright end-to-end)

## Objectives

1. Restore trust in Playwright by removing known drift and runner instability.
2. Reduce flaky behavior in the Vitest shell suite and remove skipped coverage on async race paths.
3. Strengthen cross-layer regression detection so contract, adapter, and UI behavior remain aligned.

## Priority Model

- `P0`: broken trust boundary or guaranteed regression escape.
- `P1`: high-value hardening that removes instability and deepens defect detection.
- `P2`: optimization and depth improvements that are valuable but not release-blocking.

## Workstream Plan

| ID | Priority | Layer | Item | Estimated effort |
| --- | --- | --- | --- | --- |
| TH-001 | P0 | Playwright | Align e2e tab model and assertions with current shell (`Connection/Audit/Results/Reports/Settings`), remove stale `Overview` selectors, and assert hidden-state behavior against current panels. | 0.5 day |
| TH-002 | P0 | Playwright | Move Playwright `webServer.command` to pnpm and ensure pretest uses local binary resolution (`pnpm exec playwright install chromium`) to stop runner boot failures. | 0.5 day |
| TH-003 | P0 | Playwright | Add CI smoke lane that fails fast on selector drift for top-level navigation and reports tab/download-table visibility. | 0.5 day |
| TH-004 | P1 | Integration (React shell) | Unskip recon stale-rerun race test and stabilize with deterministic deferred control; eliminate `.skip` on critical async state protection. | 1 day |
| TH-005 | P1 | Integration (React shell) | Replace timeout inflation with deterministic polling helpers (`waitFor` around explicit state transitions, fake timers where appropriate). | 1 day |
| TH-006 | P1 | Unit (adapter/helpers) | Expand negative-path assertions for normalization/error envelopes (unknown fields, malformed nested details, illegal snapshot shapes). | 1 day |
| TH-007 | P1 | Cross-layer contract | Add cross-check test that validates shell tab labels + reports table semantics against Playwright assumptions to detect future drift before e2e. | 1 day |
| TH-008 | P2 | Playwright | Add table-centric assertions for report downloads (headers, row count, href/download attrs) across compact and balanced viewports. | 0.5 day |
| TH-009 | P2 | Unit/Integration | Introduce mutation-style checks for request validation and result formatting helpers to catch weak assertions. | 1 day |
| TH-010 | P2 | Governance | Add test-quality rubric and required checklist in `contributing.md` (no skipped critical tests, no stale selector assumptions, deterministic waits). | 0.5 day |

## Detailed Feature Elaboration

### A. Playwright Reliability Features

1. **Navigation Truth Contract**
   - Assert visible tabs exactly match current product surface.
   - Validate active panel visibility and hidden state for non-active panels.
   - Protects against silent UX drift.

2. **Runner Bootstrap Consistency**
   - Use pnpm-native commands end-to-end in Playwright config and scripts.
   - Removes package-manager split brain and command-not-found failure modes.

3. **Reports Tab E2E Coverage**
   - Validate reporting operations section and report-download table in real browser flow.
   - Confirm table columns (`Report`, `Filename`, `Action`) and actionable links.

### B. Integration (App Shell) Hardening Features

1. **Async Race Safety**
   - Re-enable and stabilize stale recon response handling.
   - Guarantees old responses cannot overwrite current target-mode state.

2. **Deterministic Polling Tests**
   - Replace broad timeout extensions with state-anchored synchronization.
   - Improves speed and signal quality while reducing CI nondeterminism.

3. **Feature-to-Test Drift Sentinel**
   - Add integration-level assertion for tab inventory and reports-panel semantics.
   - Catches product-surface changes before Playwright execution.

### C. Unit Layer Hardening Features

1. **Error Envelope Robustness**
   - Verify unknown structured fields do not break operator-facing error normalization.
   - Ensure safe defaults remain stable for malformed command responses.

2. **Helper Contract Invariants**
   - Expand helper tests for validation boundaries and result formatting edge cases.
   - Focus on high-risk parsing/formatting logic that can silently regress.

## Sequenced Execution Plan

1. `P0` execution (TH-001..TH-003) -- unblock trustworthy e2e.
2. `P1` execution (TH-004..TH-007) -- stabilize async correctness and cross-layer detection.
3. `P2` execution (TH-008..TH-010) -- deepen confidence and codify quality governance.

## Validation Gates

- Gate G1 (P0 done):
  - `pnpm run test:e2e` runs with pnpm-native server command and no stale-tab failures.
- Gate G2 (P1 done):
  - skipped critical async tests removed; no timeout-only fixes required for targeted shell tests.
- Gate G3 (P2 done):
  - report table e2e assertions + test-quality checklist merged and enforced.

## Exit Criteria

- Zero stale tab-name assertions in Playwright specs.
- Zero skipped critical async behavior tests in shell suite.
- Deterministic and reproducible pnpm-based test execution across unit/integration/e2e.
- Reports tab flow covered in both integration and e2e with download-link assertions.
