# Roadmap

This directory holds the live planning, review, and execution records for the
desktop client.

## Canonical Documents

- [Backlog](./backlog.md)
- [Implementation roadmap](./implementation-roadmap.md)
- [Plan review traceability](./plan-review-traceability.md)
- [Playwright test suite](./playwright-test-suite.md)

## Validation Surface

- `npm run test:e2e` runs the browser suite that checks the tabbed shell,
  workspace-size presets, and the 800 x 600 scroll budget.
- `npm test` runs the unit suite for the React shell and desktop adapter seam.
- `npm run build` validates the production bundle.

## Current Focus

- Keep the shell compact and tabbed so inactive panels stay hidden.
- Preserve the standard laptop and desktop workspace presets in Settings.
- Keep future-state planning, product management, and validation material
  consolidated here instead of at the repo root.
- Track the remaining coverage and release-packaging hardening here rather than
  in ad hoc root-level notes.
