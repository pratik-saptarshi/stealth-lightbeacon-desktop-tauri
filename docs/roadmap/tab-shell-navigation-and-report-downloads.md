# Tab Shell Navigation and Report Downloads

Beads remains the source of truth for execution tracking. This note captures the current desktop-shell contract for workspace tabs, report downloads, and standalone validation.

## Tracked Work

- `stealth-lightbeacon-desktop-tauri-u35` - workspace tab keyboard navigation and single report download selector

## Workspace Tab Contract

- The shell exposes a horizontal tablist for `Overview`, `Connection`, `Audit`, `Results`, `Activity`, and `Settings`.
- Only one panel is active at a time; inactive panels remain hidden with `hidden={...}`.
- Keyboard interaction follows horizontal tab behavior:
  - `ArrowLeft` and `ArrowRight` move between tabs.
  - `ArrowUp` and `ArrowDown` also step between tabs for compact wrapped layouts.
  - `Home` moves to `Overview`.
  - `End` moves to `Settings`.
- Focus should stay on the selected tab after keyboard navigation.

## Report Download Contract

- The Results tab exposes a single download action instead of three separate download buttons.
- Operators choose a format from a selector, then activate one download button.
- The selected download should resolve to the generated JSON, Markdown, or HTML report for the current evaluation.
- The download action uses the same report data that powers the terminal report rendering.

## Standalone Validation Contract

- Standalone mode is a first-class execution path and must not depend on a backend API for health, capabilities, result, artifact, or recon validation.
- The Rust desktop boundary is responsible for serving the embedded standalone responses and the validation surface.
- Shell validation should verify standalone behavior through the desktop adapter, not through direct API calls.

## Validation Gates

- `npm test -- src/__tests__/app-shell.test.tsx src/__tests__/app-helpers.test.ts`
- `npm run test:coverage`
- `npm run tauri:dev`

## Notes

- The shared report source of truth remains `public/favicon.svg` for the browser header image and the packaged desktop icon generation flow.
- The tab shell should remain compact and single-panel to avoid requiring scroll-heavy navigation between workspace areas.
