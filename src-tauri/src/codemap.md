# src-tauri/src/

## Responsibility
This tree is the Tauri backend for the desktop app. It starts the Rust side of the application, persists backend connection settings, exposes the Tauri command surface used by the frontend, and turns those commands into HTTP calls against the Stealth Lightbeacon API.

## Design
- `main.rs` is only a bootstrap shim. It immediately calls `app_lib::run()`.
- `lib.rs` is the real backend module today. It holds the command contracts, config model, validation rules, HTTP adapter, app setup, and tests in one file.
- The backend is intentionally thin. It does not perform evaluation work locally; it validates requests, remembers which backend to talk to, and proxies operations to the API.
- Runtime state is minimal: `AppState` stores a single `Mutex<BackendConfig>` so every command shares the same in-memory backend target and timeout.
- Persistence is file-based. `backend-config.json` is resolved in Tauri `BaseDirectory::AppConfig`, loaded during startup, and rewritten when settings change.
- Serde structs define the local/frontend/backend contract explicitly:
  - backend config: `BackendMode`, `BackendConfig`
  - backend responses: `HealthResponse`, `ApiModeResponse`, `CapabilitiesResponse`, `CreateEvaluationResponse`, `EvaluationStatusResponse`
  - frontend request into Rust: `CreateEvaluationRequest`
  - normalized failure shape: `ApiError`
- `commands/` and `domain/` exist but are empty. They look like planned decomposition points, but today all production behavior remains in `lib.rs`.

## Flow
1. Tauri launches through `main.rs`, which delegates to `run()` in `lib.rs`.
2. `run()` builds the Tauri app, loads persisted backend config inside `.setup(...)`, falls back to the local default (`http://127.0.0.1:8000`, 15000 ms) if loading fails, and registers the command handlers.
3. The frontend calls into Rust through six Tauri commands:
   - `get_backend_config`
   - `set_backend_config`
   - `api_health_check`
   - `get_capabilities`
   - `create_evaluation`
   - `get_evaluation_status`
4. Each command reads the current config from `AppState`. `set_backend_config` also normalizes, validates, persists, and then replaces the in-memory config.
5. Networked commands delegate to `*_impl` helpers, which all converge on `send_json_request(...)`.
6. `send_json_request(...)` is the transport choke point. It validates config, builds a `reqwest` client with the configured timeout, appends the endpoint path to the normalized base URL, sends optional JSON bodies, maps timeout and transport failures into `ApiError`, rejects non-2xx responses with attached status/details, and decodes JSON on success.
7. Evaluation progress is owned by the remote backend. This layer only submits `POST /evaluations` and polls `GET /evaluations/{evaluation_id}`.

## Integration
- Frontend integration: the UI talks to this tree exclusively through Tauri `invoke(...)` calls. There is no deeper Rust domain split yet.
- Filesystem integration: config storage is app-scoped through Tauri path resolution rather than hard-coded repo paths.
- Backend API integration: the current HTTP surface is:
  - `GET /health`
  - `GET /capabilities`
  - `POST /evaluations`
  - `GET /evaluations/{evaluation_id}`
- Validation boundary:
  - backend config must contain a non-empty absolute `http` or `https` URL and a timeout between 1000 and 60000 ms
  - evaluation creation requires a target, profile, at least one output format, `max_depth` in `1..=8`, and `max_urls` in `1..=5000`
- Platform integration: `#[cfg_attr(mobile, tauri::mobile_entry_point)]` keeps the same `run()` entrypoint usable for mobile-targeted Tauri builds.
- Test integration: `lib.rs` includes unit and async tests that cover config round-tripping, invalid input rejection, and a stubbed end-to-end create-and-poll HTTP flow. That test shape matches the current architecture: this backend is an adapter around persistence, validation, and remote orchestration.
