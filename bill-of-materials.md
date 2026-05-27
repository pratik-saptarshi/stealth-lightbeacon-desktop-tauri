# Bill Of Materials

## Runtime Components

### Frontend

- `react` `^19.2.6`
- `react-dom` `^19.2.6`
- `@tauri-apps/api` `^2.11.0`
- Tabbed operator shell with viewport-density classification and `800 x 600`
  first-launch defaults in `src/App.tsx` and `src-tauri/tauri.conf.json`.

### Desktop Runtime

- `tauri` `2`
- `reqwest` `0.12` with `json` and `rustls-tls`
- `serde` `1`
- `serde_json` `1`
- `tokio` `1`

## Build And Test Tooling

- `vite` `^8.0.12`
- `vitest` `^4.1.7`
- `@vitest/coverage-v8` `^4.1.7`
- `@playwright/test` `^1.60.0`
- `axe-core` `^4.11.4`
- `typescript` `~6.0.2`
- `eslint` `^10.3.0`
- `@tauri-apps/cli` `^2.11.2`
- `@testing-library/react` `^16.3.2`
- `@testing-library/user-event` `^14.6.1`
- `@testing-library/jest-dom` `^6.9.1`
- `jsdom` `^29.1.1`
- Playwright browser smoke for the tabbed shell, workspace presets, and
  accessibility coverage in `tests/playwright/`.

## External Runtime Dependency

- Stealth Lightbeacon backend companion from the sibling backend repository
  `/Volumes/dev/Git-SCM/stealth-lightbeacon`

Validated worktree used for this integration:

- `/private/tmp/stealth-lightbeacon-phase-0a-0b`

## Release Inputs

- pinned backend OpenAPI snapshot:
  `contracts/backend-api.openapi.json`
- Tauri build configuration:
  `src-tauri/tauri.conf.json`
- release validation script:
  `scripts/release_validate.py`
- GitHub release workflow:
  `.github/workflows/release.yml`
- public documentation set:
  `changelog.md`, `README.md`, `architecture.md`, `readme-CLI.md`,
  `contributing.md`, `security-policy.md`, `bill-of-materials.md`
