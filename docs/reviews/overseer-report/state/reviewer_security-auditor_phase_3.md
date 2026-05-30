# Phase 3: Independent Review — Security Auditor
**Persona:** Security Auditor
**Primary Lens:** Command execution safety, port scanning, network leaks, credential persistence

## Overview
Reviewing the codebase for security vulnerabilities, focusing on shell injection, auth validation leaks, and untrusted network transport behaviors.

## Findings

### 1. Command Execution and Shell Parameter Security in Companion Launcher [P1] [EXISTING_DEFECT]
- **Location:** [src-tauri/src/lib.rs:353-375](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs#L353-L375)
- **Description:** In `spawn_local_backend_process_with_env`, the binary path is retrieved from environment variables `STEALTH_LIGHTBEACON_BACKEND_PYTHON` and `STEALTH_LIGHTBEACON_BACKEND_ROOT` and passed to `Command::new()`.
- **Risk:** If an attacker can manipulate environment variables in the desktop environment, they can redirect execution to a malicious script or binary. While Tauri's security model assumes local environment control, relying on unvalidated, raw environmental strings for executable pathing is an insecure practice.
- **Evidence:** Line 353 runs `Command::new(&python)`, where `python` is resolved directly from environmental context.

### 2. Lack of Authentication Controls on Standalone Mock APIs [P2] [EXISTING_DEFECT]
- **Location:** [src-tauri/src/lib.rs:1603-1633](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs#L1603-L1633)
- **Description:** In `Standalone` mode, health, capabilities, and evaluations are managed locally using embedded mock rules. No token validation is performed for evaluations, bypassing authorization controls.
- **Risk:** If standalone mode logic ever gets bridged to open ports, mock data is accessible without authorization.
- **Evidence:** Standalone command branches lack any token check routines, returning results immediately to the caller.

### 3. Cleartext Credentials and Private Config Locations [P2] [EXISTING_DEFECT]
- **Location:** [src-tauri/src/lib.rs:422-444](file:///Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/src-tauri/src/lib.rs#L422-L444)
- **Description:** `BackendConfig` is stored in cleartext inside the local user's AppConfig directory under `backend-config.json`.
- **Risk:** Sensitive parameters or custom access credentials could be leaked if an attacker gets read access to the local user directory.
- **Evidence:** Line 424 resolves `BACKEND_CONFIG_FILE` in `BaseDirectory::AppConfig` without encryption.

---

## Verdict & Recommendation
**Recommendation:** CONDITIONAL APPROVAL (5/10)
**Action:** Enforce strict path resolution validation for Python binary paths, verify environment variables against known safe prefixes, and encrypt local config storage using system-keyring utilities via keytar or specialized Tauri secure store.
