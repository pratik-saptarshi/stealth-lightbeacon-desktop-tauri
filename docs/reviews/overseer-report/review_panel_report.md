# Overseer Review Panel Report

**Work reviewed:** stealth-lightbeacon-desktop-tauri  |  **Date:** 2026-05-30
**Panel:** 4 reviewers + Auditor + Judge
**Verdict:** REJECT AND REWRITE  |  **Confidence:** High
**Auto-detected signals:** Rust, React, TypeScript, Tauri, CI/CD, Playwright
**Review mode:** Precise (auto-detected from content type)
**Data flow trace:** Standard tier | 1 path traced | 1 invariant violation
**Codebase state:** main | 0 commits behind | worktree: no

---

## Executive Summary
Following a comprehensive multi-agent adversarial review panel, this repository receives a final quality score of **4.5 / 10** with a formal recommendation of **REJECT AND REWRITE**. 

While the system is functionally operational as a local Tauri desktop client, it exhibits massive structural and architectural debt. The primary areas of concern include extreme violations of the Single Responsibility Principle (SRP) with massive monolithic files in both frontend (`App.tsx`, 109KB) and backend (`lib.rs`, 3,026 lines), critical integration test gaps where Playwright smoke tests completely bypass Rust Tauri IPC commands using standard browser mocks, a complete lack of automated cross-platform compiler packaging in GitHub Actions, and significant deadlock hazards due to excessive un-ordered Mutex locks in `AppState`. Modularity must be introduced immediately to prevent structural collapse as capabilities scale.

---

## Scope & Limitations
This review comprehensively evaluates all source code files, configurations, automated test suites, and CI/CD workflows inside the `stealth-lightbeacon-desktop-tauri` repository. 

**Limitations:**
- Excludes runtime verification of remote backend SaaS companion APIs (validated locally via OpenAPI contract drifts).
- Excludes OS-level kernel-sandbox protections or hardware-specific performance benchmarks.

**Epistemic Labels:**
- `[VERIFIED]`: Finding is fully verified against the source code.
- `[CONSENSUS]`: All panel reviewers reached consensus on this finding.
- `[EXISTING_DEFECT]`: The flaw exists in the current codebase state.

---

## Score Summary

| Reviewer | Persona | Initial Score | Final Score | Recommendation |
|----------|---------|---------------|-------------|----------------|
| Correctness Hawk | Concurrency & Threading | 6/10 | 5/10 | CONDITIONAL APPROVAL |
| Architecture Critic | SOLID & Modularity | 4/10 | 4/10 | REJECT AND REWRITE |
| Security Auditor | Shell Security & Secrets | 5/10 | 5/10 | CONDITIONAL APPROVAL |
| Devil's Advocate | Testing & CI/CD Pipelines | 3/10 | 3/10 | REJECT AND REWRITE |

**Final Arbitrated Verdict:** **4.5 / 10 (REJECT AND REWRITE)**

---

## Consensus Points
The panel reached immediate, unanimous agreement on the following critical flaws:
- **Monolithic Degradation:** The division of modular responsibility has been entirely abandoned. `lib.rs` (3,000+ lines) and `App.tsx` (109KB) act as single-file monoliths, while dedicated sub-folders (`commands/`, `domain/`, and component directories) are left completely empty.
- **Tauri Integration Testing Gap:** Playwright browser tests run in pure web-mock mode. They mock out Tauri IPC `invoke` calls entirely. This means API contract changes between TS and Rust can occur without failing any E2E tests.
- **Absence of Packaging in CI/CD:** GitHub Actions release workflow publishes text changelogs but does not compile or attach any macOS `.dmg`, Windows `.msi`, or Linux `.deb` installer packages.

---

## Disagreement Points (with Judge Rulings)
- **Granular AppState Lock Mutexes:** Hawk flagged the 5 separate `Mutex` locks in `AppState` as a high deadlock hazard. Auditor and Critic debated whether this was a severe P1 defect or a minor code style smell.
  - *Judge Ruling:* **Upheld as P1 [EXISTING_DEFECT]**. Multi-lock sequences without defined ordering contracts inevitably lead to thread deadlocks under concurrent async calls, especially since commands like `set_backend_config` perform I/O operations while locks are active.
- **Environmental Binary Executions:** Auditor raised concerns regarding launching background companions via environmental paths without checks. Advocate debated if this is a real risk given the local desktop execution model.
  - *Judge Ruling:* **Upheld as P2 [EXISTING_DEFECT]**. While local controls are assumed, defensive validation of env variables (e.g. validating paths against a strict system whitelist) is a standard security practice that should be introduced.

---

## Completeness Audit Findings
The completeness auditor identified the following overlooked flaws:
1. **Lack of Exponential Backoff in Embedded Scanning:** `run_embedded_rules_scan` performs a flat HTTP GET request with a strict 8-second timeout, failing immediately on transient glitches without retries.
2. **Duplicated, Fragmented Error Dictionaries:** Ad-hoc manual mappings of `CommandError` and `ApiError` are repeated across `lib.rs` and `desktop.ts`, creating potential error code drifts.
3. **Unchecked Release Scripts:** Automation scripts (`check_contract_sync.py`, `release_validate.py`) have no test suites.

---

## Action Items

### 1. [P1] [CONSENSUS] [VERIFIED] [EXISTING_DEFECT] Modularize Monolithic Rust Subsystem
- **Description:** Deconstruct the 3,026-line `src-tauri/src/lib.rs` file. Route Tauri commands to modular files in `src-tauri/src/commands/` and move serialization models to `src-tauri/src/domain/`.
- **Target File:** [src-tauri/src/lib.rs](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs)
- **Effort:** Medium

### 2. [P1] [CONSENSUS] [VERIFIED] [EXISTING_DEFECT] Fix AppState Concurrency Deadlock Risks
- **Description:** Consolidate the 5 separate `Mutex` guards in `AppState` into a single thread-safe `RwLock<AppStateInner>` block to enforce clear lock ordering.
- **Target File:** [src-tauri/src/lib.rs:239-245](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs#L239-L245)
- **Effort:** Medium

### 3. [P1] [CONSENSUS] [VERIFIED] [EXISTING_DEFECT] Implement Tauri Integration E2E Tests
- **Description:** Reconfigure Playwright smoke tests to launch compiled Tauri application binaries natively in a test window rather than testing mocks inside standard web browsers.
- **Target File:** [playwright.config.ts](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/playwright.config.ts) and [tests/playwright/app-shell.spec.ts](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/tests/playwright/app-shell.spec.ts)
- **Effort:** High

### 4. [P1] [CONSENSUS] [VERIFIED] [EXISTING_DEFECT] Automate Desktop Installer Releases
- **Description:** Add automated multi-platform compiler jobs (macOS, Windows, Ubuntu) to the GitHub Actions release workflow to package and attach binary installers (`.dmg`, `.msi`, `.deb`) to published tags.
- **Target File:** [.github/workflows/release.yml](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/.github/workflows/release.yml)
- **Effort:** Medium

### 5. [P2] [CONSENSUS] [VERIFIED] [EXISTING_DEFECT] Decouple Monolithic React `App.tsx`
- **Description:** Move React panels (e.g. `SettingsTab`, `CapabilitiesPanel`, `EvaluationTable`) out of `App.tsx` into modular components under `src/components/`.
- **Target File:** [src/App.tsx](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src/App.tsx)
- **Effort:** High

### 6. [P2] [CONSENSUS] [VERIFIED] [EXISTING_DEFECT] Encrypt Local Storage Configs
- **Description:** Integrate Tauri's secure store plugin or keyring utilities to store `backend-config.json` configuration variables in encrypted vaults instead of raw JSON text.
- **Target File:** [src-tauri/src/lib.rs:422-444](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs#L422-L444)
- **Effort:** Low
