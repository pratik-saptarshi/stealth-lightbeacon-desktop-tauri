# src-tauri/src/

## Responsibility

This tree is the Tauri backend for the desktop app. It starts the Rust side of
the application, persists backend connection settings, manages the local
companion lifecycle, exposes the Tauri command surface used by the frontend,
and turns those commands into HTTP calls against the Stealth Lightbeacon API.

## Design

- `main.rs` is only a bootstrap shim. It immediately calls `app_lib::run()`.
- `lib.rs` is the real backend module today. It holds the command contracts,
  config model, validation rules, local companion lifecycle, HTTP adapter, app
  setup, and tests in one file.
- The backend is intentionally thin. It does not perform evaluation work
  itself; it validates requests, remembers which backend to talk to, enforces
  transport policy, and proxies operations to the API.
- Runtime state includes persisted config, bootstrap errors, and the optional
  managed local companion process.
- Persistence is file-based. `backend-config.json` and the last-opened terminal
  snapshot are resolved in Tauri `BaseDirectory::AppConfig`.
- Serde structs define the local/frontend/backend contract explicitly.

## Flow

1. Tauri launches through `main.rs`, which delegates to `run()` in `lib.rs`.
2. `run()` builds the Tauri app, loads persisted backend config inside
   `.setup(...)`, falls back to the local default (`http://127.0.0.1:8000`,
   15000 ms) if loading fails, and registers the command handlers.
3. The frontend calls into Rust through Tauri commands for config, health,
   capabilities, evaluation creation, evaluation status, terminal result
   retrieval, artifact retrieval, recon, and snapshot persistence.
4. In local mode, effective config resolution can spawn the sibling backend
   companion, wait for readiness, and reuse the discovered loopback URL.
5. Networked commands delegate to `*_impl` helpers, which converge on
   `send_json_request(...)`.
6. `send_json_request(...)` is the transport choke point. It validates config,
   builds a `reqwest` client with the configured timeout, appends the endpoint
   path to the normalized base URL, sends optional JSON bodies, injects the
   desktop-version header and optional remote auth token, maps timeout and
   transport failures into `ApiError`, rejects non-2xx responses with attached
   status/details, and decodes JSON on success.
7. Evaluation progress is owned by the backend. This layer submits, polls,
   retrieves terminal outputs, and persists only the thin local snapshot.

## Integration

- Frontend integration: the UI talks to this tree exclusively through Tauri
  `invoke(...)` calls.
- Filesystem integration: config and snapshot storage are app-scoped through
  Tauri path resolution rather than hard-coded repo paths.
- Backend API integration covers `/health`, `/capabilities`, `/evaluations`,
  `/evaluations/{evaluation_id}`, `/evaluations/{evaluation_id}/result`,
  `/evaluations/{evaluation_id}/artifacts`, and `/recon`.
- Validation boundary:
  - backend config must contain a non-empty absolute `http` or `https` URL and
    a timeout between 1000 and 60000 ms
  - remote mode requires `https` and reads auth from
    `STEALTH_LIGHTBEACON_REMOTE_AUTH_TOKEN`
  - evaluation creation requires a target, profile, at least one output format,
    `max_depth` in `1..=8`, and `max_urls` in `1..=5000`
- Test integration: `lib.rs` includes unit and async tests that cover config
  round-tripping, invalid input rejection, local companion lifecycle, real
  backend integration, result and artifact retrieval, recon, and snapshot
  persistence.
