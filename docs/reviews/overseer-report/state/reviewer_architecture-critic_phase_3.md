# Phase 3: Independent Review — Architecture Critic
**Persona:** Architecture Critic
**Primary Lens:** SOLID principles, design patterns, separation of concerns, coupling

## Overview
Evaluating the high-level architecture of `stealth-lightbeacon-desktop-tauri` against standard clean architecture and SOLID principles. The focus is on decoupling frontend React structures and Tauri Rust subsystems.

## Findings

### 1. Monolithic Violation of SRP in Rust Subsystem [P1] [EXISTING_DEFECT]
- **Location:** [src-tauri/src/lib.rs](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs)
- **Description:** A single `lib.rs` file spanning over 3,000 lines contains the entire backend! It manages:
  1. Tauri IPC Command Handlers (`#[tauri::command]`)
  2. Subprocess state management and companion launcher logic
  3. HTTP client configuration and network calls (`ureq`/`reqwest`)
  4. Local configuration save/load serialization
  5. Mock scan execution logic
  6. Unit testing suites
- **Risk:** High maintenance complexity. Every change to commands, network payloads, or mock rules requires updating this huge file. The `commands/` and `domain/` directories remain completely empty, indicating structural degeneration.
- **Evidence:** The entire file structure is flat; all modules are collapsed.

### 2. Violations of SOLID in Tauri AppState Management [P2] [EXISTING_DEFECT]
- **Location:** [src-tauri/src/lib.rs:239-270](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs#L239-L270)
- **Description:** `AppState` is coupled directly to specific concrete types (`BackendConfig`, `LocalBackendProcess`, etc.). This violates the Dependency Inversion Principle (DIP).
- **Risk:** Highly rigid design. If the backend changes from a local Python companion process to a Docker container or remote-only SaaS, we must modify the core state machine and commands.
- **Evidence:** Lack of abstractions or traits. All operations access concrete struct fields directly.

### 3. Monolithic React Component and Viewport Duplication [P2] [EXISTING_DEFECT]
- **Location:** [src/App.tsx](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src/App.tsx)
- **Description:** `App.tsx` has 109KB of React code. It manages state for the entire app: settings, viewport-switching hooks, polling states, CSS rules, artifact lists, capabilities configurations, and the full UI elements.
- **Risk:** High code duplication and extremely poor code reuse. Violates Single Responsibility Principle. Complex interactive code is tightly coupled to stylistic layouts, preventing independent testing of UI blocks.
- **Evidence:** Multi-hundred-line JSX blocks with deep conditional trees (`mode === 'local' ? ... : ...`).

---

## Verdict & Recommendation
**Recommendation:** REJECT AND REWRITE (4/10)
**Action:** Decouple `lib.rs` immediately by routing Tauri command definitions to `src-tauri/src/commands/` and domain models to `src-tauri/src/domain/`. Break down `src/App.tsx` into modular components under `src/components/` (e.g. `SettingsTab.tsx`, `CapabilitiesTab.tsx`, `EvaluationTab.tsx`).
