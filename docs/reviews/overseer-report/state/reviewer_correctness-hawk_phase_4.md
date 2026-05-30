# Phase 4: Private Reflection — Correctness Hawk

## Findings Re-evaluation

| Finding | Severity | Confidence | Rationale |
|---------|----------|------------|-----------|
| 1. Concurrency Deadlock & Lock Contention in `AppState` | P1 | High | Mutex locking sequence is unchecked. Multiple locked states inside Tauri `State<'_, AppState>` easily trigger deadlock if concurrent commands execute. |
| 2. Tauri IPC Boundary Schema Mapping Vulnerability | P2 | High | Manual JS coalesce filters (`??`) confirm that the schema is fragile. Any JSON key drift in Rust instantly breaks the frontend interface. |
| 3. Missing Path Bounds in Subprocess Launcher | P2 | Medium | Port is safe because it's a `u16`, but environment variable lookups for Python pathing lack formatting and length checks. |

## Most Defensible Finding
**Finding 1 (Deadlock Risk):** The lock sequence is verifiable by tracing lock operations in `lib.rs` and React calls. Locking 5 individual state components sequentially without structured transaction boundaries is extremely prone to resource deadlocks under parallel workloads.

## Least Defensible Finding
**Finding 3 (Subprocess Bounds):** Spawning binaries via environmental paths is generally assumed to be locally controlled, and length bounds wouldn't mitigate a compromised machine where an attacker has already overwritten environment variables.
