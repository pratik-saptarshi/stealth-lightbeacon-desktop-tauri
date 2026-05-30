# Phase 3: Independent Review — Correctness Hawk
**Persona:** Correctness Hawk
**Primary Lens:** Concurrency, deadlock risk, serialization safety, input validation

## Overview
Evaluating the repository's backend Rust (`src-tauri/src/lib.rs`) and frontend adapter (`src/lib/desktop.ts`) for synchronization hazards, serialization edge cases, and runtime correctness.

## Findings

### 1. Concurrency Deadlock & Lock Contention in `AppState` [P1] [EXISTING_DEFECT]
- **Location:** [src-tauri/src/lib.rs:239-245](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs#L239-L245)
- **Description:** `AppState` holds 5 separate, granular `Mutex` wraps:
  ```rust
  struct AppState {
      backend_config: Mutex<BackendConfig>,
      bootstrap_error: Mutex<Option<ApiError>>,
      local_backend: Mutex<Option<LocalBackendProcess>>,
      standalone_jobs: Mutex<HashMap<String, StandaloneEvaluation>>,
      standalone_sequence: Mutex<u64>,
  }
  ```
- **Risk:** Commands like `set_backend_config` acquire multiple locks in sequence (`local_backend` lock then `backend_config` lock). If concurrent frontend polling requests lock these variables in a different sequence (e.g. while inspecting health or capabilities), it presents a high risk of thread deadlock.
- **Evidence:** `set_backend_config` locks `local_backend` inside `stop_local_backend_in_app_state` (line 384) and then locks `backend_config` via `replace_backend_config_in_app_state` (line 1561).

### 2. Tauri IPC Boundary Schema Mapping Vulnerability [P2] [EXISTING_DEFECT]
- **Location:** [src/lib/desktop.ts:120-147](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src/lib/desktop.ts#L120-L147) and [src-tauri/src/lib.rs:120-127](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs#L120-L127)
- **Description:** The Rust backend uses `#[serde(rename_all = "camelCase")]` for struct serialization. However, `get_evaluation_result` returns dynamic `serde_json::Value` structures that bypass normal Serde parsing. The React frontend relies on complex, manual manual normalization helpers (`normalizeEvaluationResultResponse`, `normalizeFindings`) to map field keys like `startedAt` vs `started_at`.
- **Risk:** If the backend companion api drifts or returns snake_case keys under `summary`, React fails to render them correctly due to fragile manual validation loops.
- **Evidence:** [desktop.ts:133-145](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src/lib/desktop.ts#L133-L145) features multiple back-to-back coalescing lookups (`candidate.startedAt ?? candidate.started_at ?? summary.startedAt ?? summary.started_at`).

### 3. Missing String Boundaries / Bounds Validation in Subprocess [P2] [EXISTING_DEFECT]
- **Location:** [src-tauri/src/lib.rs:360-362](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs#L360-L362)
- **Description:** In `spawn_local_backend_process_with_env`, the port is converted to a string directly (`port.to_string()`). The port itself is a `u16`, preventing shell escape injection. However, the custom path for Python `STEALTH_LIGHTBEACON_BACKEND_PYTHON` and backend root `STEALTH_LIGHTBEACON_BACKEND_ROOT` are fetched from environmental variables or derived from manifesto dirs and passed directly to `Command::new` without validating length or bounds.
- **Risk:** Potential OS crashes or command execution failures due to missing validation of environment paths.

---

## Verdict & Recommendation
**Recommendation:** CONDITIONAL APPROVAL (6/10)
**Action:** Consolidate `AppState` locks into a single read-write lock (`RwLock<AppStateInner>`) to eliminate cross-mutex deadlock vectors, and replace manual field mapping in JS with solid Zod models synchronized with openapi definitions.
