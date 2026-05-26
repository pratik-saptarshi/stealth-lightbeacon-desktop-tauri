# src/test/

## Responsibility

This folder holds shared frontend test setup for the React/Vitest suite.

## Design

- `setup.ts` is loaded before frontend tests and installs the DOM matchers from
  `@testing-library/jest-dom`.
- The folder is intentionally small. Test logic lives in `src/__tests__/`,
  while this directory only carries common bootstrapping concerns.

## Flow

1. Vitest starts the browser-like test environment.
2. `src/test/setup.ts` runs before test files.
3. Matchers and globals become available to the React test suite.

## Integration

- Consumed by `vitest.config.ts`.
- Supports `src/__tests__/app-shell.test.tsx` and any future frontend tests that
  need shared matcher/bootstrap behavior.
