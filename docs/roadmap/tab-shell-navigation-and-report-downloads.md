# Tab Shell Navigation and Report Downloads

Beads remains the source of truth for execution tracking. This note captures the current desktop-shell contract for workspace tabs, report downloads, and standalone validation.

## Tracked Work

- `stealth-lightbeacon-desktop-tauri-8n8` - R6 adversarial UX contract hardening epic
- `stealth-lightbeacon-desktop-tauri-8n8.1` - regression assertion hardening
- `stealth-lightbeacon-desktop-tauri-8n8.2` - artifact-backed report action enforcement
- `stealth-lightbeacon-desktop-tauri-8n8.3` - single report-download surface enforcement

## Workspace Tab Contract

- The shell exposes a horizontal tablist for `Connection`, `Audit`, `Results`, `Reports`, and `Settings`.
- Only one panel is active at a time; inactive panels remain hidden with `hidden={...}`.
- Keyboard interaction follows horizontal tab behavior:
  - `ArrowLeft` and `ArrowRight` move between tabs.
  - `ArrowUp` and `ArrowDown` also step between tabs for compact wrapped layouts.
  - `Home` moves to `Connection`.
  - `End` moves to `Settings`.
- Focus should stay on the selected tab after keyboard navigation.

## Report Download Contract

- Report download operations are rendered in the `Reports` tab table (`Report`, `Filename`, `Action`).
- The `Results` tab does not render a duplicated formatted-report download block.
- Report-table actions are artifact-backed (`artifact.downloadUrl`) and open as direct links.
- Duplicate artifact entries should not produce duplicate report-table rows.

## Standalone Validation Contract

- Standalone mode is a first-class execution path and must not depend on a backend API for health, capabilities, result, artifact, or recon validation.
- The Rust desktop boundary is responsible for serving the embedded standalone responses and the validation surface.
- Shell validation should verify standalone behavior through the desktop adapter, not through direct API calls.

## Validation Gates

- `pnpm test -- src/__tests__/app-shell.test.tsx`
- `pnpm test -- src/__tests__/app-helpers.test.ts`
- `pnpm run test:e2e`

## Notes

- The shared report source of truth remains `public/favicon.svg` for the browser header image and the packaged desktop icon generation flow.
- The tab shell should remain compact and single-panel to avoid requiring scroll-heavy navigation between workspace areas.
