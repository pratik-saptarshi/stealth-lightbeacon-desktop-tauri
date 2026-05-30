# Overseer Adversarial App Gap Report

This report captures implementation gaps identified by the latest adversarial
app audit and integrates them into desktop planning artifacts.

## Scope

- React shell tabbed workflow (`src/App.tsx`)
- Report/download UX across Results and Reports tabs
- Test-layer coverage for report operations and trace visibility toggles
- Roadmap contract alignment with implemented shell behavior

## Gap Matrix

| Gap ID | Severity | Area | Evidence | Implementation Gap | Required Remediation |
| --- | --- | --- | --- | --- | --- |
| OA-APP-01 | HIGH | Reporting UX | Reports tab rendered generated report downloads instead of artifact-backed links. | Reports operations table did not guarantee actionable artifact download URLs. | Route table actions to artifact `downloadUrl` links and deduplicate rows. |
| OA-APP-02 | HIGH | Results UX | Results tab exposed a duplicated "Formatted Reports" section. | Report-download surface split across two tabs created duplicate operator actions. | Remove Results-tab formatted downloads; keep a single report-download surface in Reports. |
| OA-APP-03 | MEDIUM | Traceability docs | Tab-navigation/report-contract note diverged from current tab model and report flow. | Roadmap guidance still referenced removed/legacy tab behavior. | Update roadmap truth docs and map old assumptions to current shell contract. |
| OA-APP-04 | MEDIUM | Test hardening | Tests previously validated legacy output assumptions and broad text selectors. | Adversarial scenarios can regress behavior without precise assertion coverage. | Keep targeted assertions for no-duplicate downloads and artifact URL actions in app-shell tests. |

## Disposition

- `OA-APP-01`: Applied
- `OA-APP-02`: Applied
- `OA-APP-03`: Bundled into roadmap maintenance backlog
- `OA-APP-04`: Applied with ongoing hardening follow-up

## Validation Anchors

- `pnpm test -- src/__tests__/app-shell.test.tsx`
- Reports tab:
  - table rows render artifact-backed download links
  - duplicate report-download surface removed from Results
- Results tab:
  - terminal report and artifacts remain available
  - no standalone formatted-download section rendered

## Follow-up

- Keep `docs/roadmap/plan-review-traceability.md` updated per adversarial round.
- Keep report UX contract docs synchronized whenever tabs or reporting operations change.
