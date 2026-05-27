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
- `npm test` runs the unit suite for the React shell and desktop adapter seam.
- `npm run test:coverage` measures the React shell coverage gate at 80 percent
  or higher.
- `npm run test:e2e` also covers recon advisory visibility and axe-core scans
  on the shell, Settings, and Audit views.
- `npm run build` validates the production bundle.

## Current Focus

- Keep the shell compact and tabbed so inactive panels stay hidden.
- Preserve the standard laptop and desktop workspace presets in Settings.
- Keep roadmap and review material consolidated here instead of at the repo
  root.
