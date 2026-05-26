# src/lib/

## Responsibility

Provides the frontend-side desktop adapter. Today that means a single
`desktop.ts` module that defines the TypeScript contracts for backend
configuration, evaluation, recon, and snapshot APIs; exposes small Tauri
command wrappers; and converts command failures into UI-ready strings.

## Design

The module is intentionally narrow: plain exported types plus stateless async
helpers. `invokeCommand()` lazily imports `@tauri-apps/api/core`, which keeps
browser preview from eagerly loading the Tauri runtime. `isDesktopRuntime()`
gives the UI a cheap guard before any command call, and
`formatCommandError()` centralizes how structured Rust-side errors become
human-readable notices.

## Flow

`App.tsx` calls `isDesktopRuntime()` before enabling desktop actions. For
desktop sessions, `getBackendConfig()` and `setBackendConfig()` manage
persisted connection settings, `apiHealthCheck()` and `getCapabilities()`
hydrate the connection and form state, `createEvaluation()` plus
`getEvaluationStatus()` drive the submission and polling loop, and
`getEvaluationResult()`, `getEvaluationArtifacts()`, `runRecon()`,
`getLastOpenedSnapshot()`, and `setLastOpenedSnapshot()` cover the terminal,
artifact, recon, and restore flows. These helpers forward typed arguments to
named Tauri commands and return typed payloads without additional client-side
caching or transformation.

## Integration

`src/lib/desktop.ts` is the seam between the React shell and the Rust backend
bridge. It is imported by `src/App.tsx` and mocked by
`src/__tests__/app-shell.test.tsx`, so changes here affect both runtime
behavior and frontend tests. The command names and payload shapes must stay
aligned with the Tauri command layer in `src-tauri/`.
