# src/

## Responsibility

Hosts the React frontend for the desktop client. This tree mounts the app, renders the Phase 1 evaluation workflow, and keeps Tauri command details behind `src/lib/desktop.ts`.

## Design

`main.tsx` is the thin entrypoint: it mounts `<App />` inside `StrictMode` and loads global styles from `index.css`. `App.tsx` is the current feature shell and owns UI state for backend configuration, health, capabilities, evaluation submission, polling, and recent activity. `App.css` provides the screen-specific layout and panel styling, while `index.css` defines global typography, color tokens, and page background. Tests under `src/__tests__/` exercise the shell by mocking the desktop adapter instead of reaching into component internals.

## Flow

On boot, `App.tsx` checks `isDesktopRuntime()`. In Tauri, it loads persisted backend config, then refreshes `/health` and `/capabilities`, using the returned capability lists to reconcile the request form. Saving the connection writes the edited config through the desktop adapter and immediately re-checks connectivity. Submitting an evaluation posts the current request, seeds a local queued state, and starts a 1.5 second polling loop until the backend returns a terminal status. In browser preview, the same shell renders, but actions are disabled and notices explain that persistence and API calls require the desktop runtime.

## Integration

This folder depends on React for rendering and state transitions, and on `src/lib/desktop.ts` for every runtime-specific operation. The UI assumes Tauri commands exist for backend config, health, capabilities, evaluation creation, and evaluation status lookup. The frontend does not talk to HTTP directly; the Rust side remains the transport boundary.
