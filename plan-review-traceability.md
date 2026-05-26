# Plan Review Traceability

Review findings are integrated into the roadmap using four analysis buckets:
feature gaps, capability gaps, validation gaps, and testing gaps.

## Round 1: Desktop Adversarial Review

`Total findings: 13 | Must-fix: 6 | Bundle: 6 | Defer: 0 | Info: 1`
`Final Recommendation: Auto-applied`
`Dissent Ledger: none`

| ID | Severity | Bucket | Summary | Category | Action Taken |
| --- | --- | --- | --- | --- | --- |
| R1-F01 | HIGH | Validation gap | Corrupted persisted config silently falls back to localhost. | Must-fix | + to `Phase 1R` as fail-closed config handling plus recovery UX and tests. |
| R1-F02 | HIGH | Capability gap | Structured `ApiError` semantics are lost across the Rust/TS boundary. | Must-fix | + to `Phase 1R` as typed error-envelope preservation with adapter and IPC tests. |
| R1-F03 | HIGH | Validation gap | React can construct contract-invalid evaluation payloads. | Must-fix | + to `Phase 1R` as client validation plus shared contract checks. |
| R1-F04 | MEDIUM | Validation gap | `evaluation_id` is not URL-encoded. | Bundle | + to `Phase 1R` as path-encoding hardening with regression tests. |
| R1-F05 | LOW | Feature gap | Docs overstate active-session persistence. | Informational | Corrected by the roadmap and related docs; active-session persistence is now an explicit decision in `Phase 1R`. |
| R1-F06 | HIGH | Capability gap | `BackendMode` is a label, not enforced policy. | Bundle | Pulled forward into `Phase 3` with an earlier safety-floor note in `Phase 1R`. |
| R1-F07 | MEDIUM | Capability gap | Manual OpenAPI snapshot can drift from runtime DTOs. | Bundle | + automated contract sync and drift detection to `Phase 5`, with contract review at the start of every phase. |
| R1-F08 | HIGH | Capability gap | Submit remains available when `/capabilities` fails. | Must-fix | + to `Phase 1R` as capability-gated submission and degraded-mode policy. |
| R1-F09 | HIGH | Capability gap | Polling dies on the first transient err and cannot resume. | Must-fix | + to `Phase 1R` as retry/recovery behavior and persistence decision. |
| R1-F10 | HIGH | Testing gap | Frontend tests mock the desktop adapter and miss real IPC coverage. | Must-fix | + a required Tauri IPC lane to `Phase 1R`. |
| R1-F11 | MEDIUM | Feature gap | Result and artifact routes exist in contract but not in desktop runtime. | Bundle | Split into `Phase 2A` and `Phase 2B` for end-to-end terminal workflow completion. |
| R1-F12 | MEDIUM | Feature gap | Recon exists in contract but is not wired in the desktop app. | Bundle | Kept as additive feature scope in `Phase 4` after base workflow and operability phases. |
| R1-F13 | HIGH | Capability gap | Local lifecycle, remote auth, version compatibility, TLS hardening, thin cache, and release hardening remain absent. | Bundle | Split across `Phase 3` and `Phase 5`, with safety-critical pieces moved earlier. |

- `Feature gaps`: `R1-F05`, `R1-F11`, `R1-F12`
- `Capability gaps`: `R1-F02`, `R1-F06`, `R1-F07`, `R1-F08`, `R1-F09`, `R1-F13`
- `Validation gaps`: `R1-F01`, `R1-F03`, `R1-F04`
- `Testing gaps`: `R1-F10`

| Priority | Owner | Action | src finding |
| --- | --- | --- | --- |
| P1 | implementer | Execute `Phase 1R` before adding new feature scope. | R1-F01, R1-F02, R1-F03, R1-F08, R1-F09, R1-F10 |
| P1 | implementer | Add real Tauri IPC coverage and keep it green in every later phase. | R1-F10 |
| P1 | implementer | Complete terminal result and artifact flows before recon. | R1-F11 |
| P1 | implementer | Turn `BackendMode` and hybrid mode into real policy-driven runtime behavior. | R1-F06, R1-F13 |
| P2 | implementer | Add automated contract drift detection and release hardening workflow. | R1-F07, R1-F13 |

## Round 2: Cross-Repo Contract And Lifecycle Review

`Total findings: 10 | Must-fix: 7 | Bundle: 3 | Defer: 0 | Info: 0`
`Final Recommendation: Auto-applied`
`Dissent Ledger: none`

| ID | Severity | Bucket | Summary | Category | Action Taken |
| --- | --- | --- | --- | --- | --- |
| R2-F01 | HIGH | Feature gap | The sibling backend repo exposes a CLI, not the HTTP route surface the desktop consumes. | Must-fix | Reset the roadmap around backend route creation in `Phase 1A`, `Phase 1B`, `Phase 2A`, `Phase 2B`, and `Phase 4`. |
| R2-F02 | HIGH | Capability gap | Backend orchestration is wired through the Typer CLI rather than a reusable service layer. | Must-fix | Added `Phase 0B` to extract evaluation, result, artifact, and recon services before server work. |
| R2-F03 | HIGH | Validation gap | The desktop repo names backend `/openapi.json` as source of truth, but the sibling backend repo does not produce that artifact. | Must-fix | Added `Phase 0A` contract re-baseline plus producer-side OpenAPI generation and sync gating. |
| R2-F04 | HIGH | Capability gap | No asynchronous evaluation ID and polling model exists in the backend repo. | Must-fix | Added `Phase 1B` for backend-owned job state and evaluation status route implementation. |
| R2-F05 | HIGH | Validation gap | Desktop evaluation request fields do not map cleanly onto backend CLI inputs. | Must-fix | Added request-schema reconciliation as a `Phase 0A` and `Phase 1B` acceptance lane. |
| R2-F06 | HIGH | Validation gap | Desktop result and recon DTOs do not match the backend repo's current report and recon shapes. | Must-fix | Added explicit result alignment in `Phase 2A` and recon alignment in `Phase 4`. |
| R2-F07 | HIGH | Capability gap | No local companion lifecycle or remote auth/version policy surface exists in the backend repo. | Must-fix | Split later work into `Phase 3A` local companion lifecycle and `Phase 3B` remote auth and compatibility policy. |
| R2-F08 | MEDIUM | Feature gap | Backend artifacts exist only as files, not as API descriptors keyed by evaluation ID. | Bundle | Added artifact descriptor work to `Phase 2B`. |
| R2-F09 | MEDIUM | Testing gap | No backend HTTP route tests or cross-repo producer-consumer integration harness exists. | Bundle | Added test-first producer, consumer, and integration checks to every phase in the new roadmap. |
| R2-F10 | MEDIUM | Testing gap | No companion lifecycle smoke lane exists for startup, readiness, degraded mode, and shutdown. | Bundle | Added lifecycle validation gates in `Phase 3A` and end-to-end smoke work in `Phase 5`. |

- `Feature gaps`: `R2-F01`, `R2-F08`
- `Capability gaps`: `R2-F02`, `R2-F04`, `R2-F07`
- `Validation gaps`: `R2-F03`, `R2-F05`, `R2-F06`
- `Testing gaps`: `R2-F09`, `R2-F10`

| Priority | Owner | Action | src finding |
| --- | --- | --- | --- |
| P1 | implementer | Stop treating remaining work as desktop-only; start with backend contract production and service extraction. | R2-F01, R2-F02, R2-F03 |
| P1 | implementer | Build backend route and job-state substrate before any new desktop-only feature work. | R2-F01, R2-F04, R2-F08 |
| P1 | implementer | Reconcile request, result, and recon schemas explicitly, not by inference. | R2-F05, R2-F06 |
| P1 | implementer | Keep local companion and remote policy work behind real backend substrate and lifecycle tests. | R2-F07, R2-F10 |
| P2 | implementer | Add producer-consumer contract and integration automation before release hardening. | R2-F03, R2-F09 |
