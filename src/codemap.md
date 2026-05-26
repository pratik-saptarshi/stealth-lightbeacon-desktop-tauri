# src/

## Responsibility

Hosts the React frontend for the desktop client. This tree mounts the app,
renders the full operator workflow, and keeps Tauri command details behind
`src/lib/desktop.ts`.

## Design

`main.tsx` is the thin entrypoint: it mounts `<App />` inside `StrictMode` and
loads global styles from `index.css`. `App.tsx` owns UI state for backend
configuration, health, capabilities, evaluation submission, polling, terminal
results, artifacts, and last-opened snapshot restore. `App.css` provides the
screen layout and panel styling, while `index.css` defines global tokens and
page background. Tests under `src/__tests__/` exercise the shell through the
desktop adapter boundary.

## Flow

On boot, `App.tsx` checks `isDesktopRuntime()`. In Tauri, it loads persisted
backend config and any saved terminal snapshot, then refreshes `/health` and
`/capabilities`, using capability data to reconcile the request form. Saving
the connection writes the edited config through the desktop adapter and
immediately re-checks connectivity. Submitting an evaluation posts the current
request, seeds a local queued state, and starts a polling loop until the
backend returns a terminal status. After terminal completion, the shell loads
the result and artifacts and persists the thin snapshot. Recon transport exists
in the adapter but is not yet surfaced in the operator shell. In browser
preview, the same shell renders but desktop actions remain disabled.

## Integration

This folder depends on React for rendering and on `src/lib/desktop.ts` for
every runtime-specific operation. The UI assumes Tauri commands exist for
backend config, health, capabilities, evaluation creation, evaluation status,
terminal result retrieval, artifact retrieval, and snapshot persistence. The
frontend does not talk to HTTP directly; Rust remains the transport boundary.
