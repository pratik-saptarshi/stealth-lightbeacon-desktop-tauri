# Playwright Test Suite

The browser suite lives in `tests/playwright/app-shell.spec.ts` and is executed
with `npm run test:e2e`.

## Coverage

- Tab navigation keeps inactive panels hidden and preserves a single active
  workspace view.
- Settings expose the standard workspace-size presets for laptop and desktop
  layouts.
- The compact baseline at `800 x 600` stays within the viewport without
  vertical scrolling.

## Harness

- `playwright.config.ts` launches the local Vite dev server on `127.0.0.1:4180`.
- The browser viewport is fixed to `800 x 600` so the compact-shell budget is
  reproducible.
- The suite uses explicit role-based selectors so the tab and radio controls
  are stable across DOM refactors.

## Execution

- `npm run test:e2e`
- `npm run test:e2e:headed`

## Notes

- Keep the suite focused on visible operator behavior, not implementation
  details.
- Keep browser checks separate from Vitest so unit and e2e failures stay easy to
  interpret.
