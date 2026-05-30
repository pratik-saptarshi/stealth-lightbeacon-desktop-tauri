# Plan Review Traceability

Review findings are integrated into the roadmap using four analysis buckets:
feature gaps, capability gaps, validation gaps, and testing gaps.

## Round 1: Desktop Adversarial Review

`Total findings: 13 | Must-fix: 6 | Bundle: 6 | Defer: 0 | Info: 1`
`Final Recommendation: Auto-applied`
`Dissent Ledger: none`

| ID | Severity | Bucket | Summary | Category | Action Taken |
| --- | --- | --- | --- | --- | --- |
| R1-F01 | HIGH | Validation gap | Corrupted persisted config silently falls back to localhost. | Must-fix | Added fail-closed config handling plus recovery UX and tests. |
| R1-F02 | HIGH | Capability gap | Structured `ApiError` semantics are lost across the Rust/TS boundary. | Must-fix | Added typed error-envelope preservation with adapter and IPC tests. |
| R1-F03 | HIGH | Validation gap | React can construct contract-invalid evaluation payloads. | Must-fix | Added client validation plus shared contract checks. |
| R1-F04 | MEDIUM | Validation gap | `evaluation_id` is not URL-encoded. | Bundle | Added path-encoding hardening with regression tests. |
| R1-F05 | LOW | Feature gap | Docs overstate active-session persistence. | Info | Corrected by later roadmap and architecture updates. |
| R1-F06 | HIGH | Capability gap | `BackendMode` is a label, not enforced policy. | Bundle | Pulled forward into hybrid operability work. |
| R1-F07 | MEDIUM | Capability gap | Manual OpenAPI snapshot can drift from runtime DTOs. | Bundle | Added contract sync and drift detection to release hardening. |
| R1-F08 | HIGH | Capability gap | Submit remains available when `/capabilities` fails. | Must-fix | Added capability-gated submission and degraded-mode policy. |
| R1-F09 | HIGH | Capability gap | Polling dies on the first transient error and cannot resume. | Must-fix | Added retry and recovery behavior. |
| R1-F10 | HIGH | Testing gap | Frontend tests mock the desktop adapter and miss real IPC coverage. | Must-fix | Added a required Tauri IPC lane. |
| R1-F11 | MEDIUM | Feature gap | Result and artifact routes exist in contract but not in desktop runtime. | Bundle | Split into terminal result and artifact phases. |
| R1-F12 | MEDIUM | Feature gap | Recon exists in contract but is not wired in the desktop app. | Bundle | Kept as additive feature scope after the base workflow. |
| R1-F13 | HIGH | Capability gap | Local lifecycle, remote auth, version compatibility, TLS hardening, thin cache, and release hardening remain absent. | Bundle | Split across hybrid operability and release-hardening phases. |

## Round 2: Cross-Repo Contract And Lifecycle Review

`Total findings: 10 | Must-fix: 7 | Bundle: 3 | Defer: 0 | Info: 0`
`Final Recommendation: Auto-applied`
`Dissent Ledger: none`

| ID | Severity | Bucket | Summary | Category | Action Taken |
| --- | --- | --- | --- | --- | --- |
| R2-F01 | HIGH | Feature gap | The sibling backend repo exposed a CLI, not the HTTP route surface the desktop consumed. | Must-fix | Reset the roadmap around backend route creation. |
| R2-F02 | HIGH | Capability gap | Backend orchestration was wired through the CLI rather than a reusable service layer. | Must-fix | Added service extraction before server work. |
| R2-F03 | HIGH | Validation gap | The desktop repo named backend `/openapi.json` as the source of truth, but the backend did not produce that artifact. | Must-fix | Added producer-side OpenAPI generation and sync gating. |
| R2-F04 | HIGH | Capability gap | No asynchronous evaluation ID and polling model existed in the backend repo. | Must-fix | Added backend-owned job state and evaluation status routing. |
| R2-F05 | HIGH | Validation gap | Desktop evaluation request fields did not map cleanly onto backend CLI inputs. | Must-fix | Added request-schema reconciliation acceptance lanes. |
| R2-F06 | HIGH | Validation gap | Desktop result and recon DTOs did not match backend report and recon shapes. | Must-fix | Added explicit result and recon alignment phases. |
| R2-F07 | HIGH | Capability gap | No local companion lifecycle or remote auth/version policy surface existed in the backend repo. | Must-fix | Split local lifecycle from remote policy work. |
| R2-F08 | MEDIUM | Feature gap | Backend artifacts existed only as files, not API descriptors keyed by evaluation ID. | Bundle | Added artifact descriptor work. |
| R2-F09 | MEDIUM | Testing gap | No backend HTTP route tests or cross-repo producer-consumer integration harness existed. | Bundle | Added producer, consumer, and integration checks to every phase. |
| R2-F10 | MEDIUM | Testing gap | No companion lifecycle smoke lane existed for startup, readiness, degraded mode, and shutdown. | Bundle | Added lifecycle validation gates and final smoke work. |

## Round 3: Release Truth Review

`Total findings: 5 | Must-fix: 3 | Bundle: 2 | Defer: 0 | Info: 0`
`Final Recommendation: Auto-applied`
`Dissent Ledger: none`

| ID | Severity | Bucket | Summary | Category | Action Taken |
| --- | --- | --- | --- | --- | --- |
| R3-F01 | HIGH | Validation gap | Root docs and codemaps still described completed phases as missing or blocked. | Must-fix | Rewrote the completion ledger, codemaps, and architecture docs to match verified runtime reality. |
| R3-F02 | HIGH | Capability gap | Release validation stopped at the frontend bundle and did not validate the Tauri package boundary. | Must-fix | Updated the release lane to run `npm run tauri:build` and enabled bundling in Tauri config. |
| R3-F03 | HIGH | Capability gap | This checkout has no Git remote configured, so GitHub publication is impossible from current state. | Must-fix | Added explicit publication work to the merged remediation backlog and release notes. |
| R3-F04 | MEDIUM | Feature gap | Governance docs for contribution, security reporting, and bill of materials were missing. | Bundle | Added `contributing.md`, `security-policy.md`, and `bill-of-materials.md`. |
| R3-F05 | MEDIUM | Validation gap | `AGENTS.md` and folder codemaps would misdirect future agents. | Bundle | Refreshed repo guidance and folder maps to reflect the completed implementation. |
| R3-F06 | MEDIUM | Feature gap | Recon transport exists but the operator workflow is absent from `src/App.tsx`. | Bundle | Added remaining React recon work to the merged backlog. |
| R3-F07 | MEDIUM | Feature gap | Remote auth and compatibility handling are mostly transport-level, not explicit operator UX. | Bundle | Added operator-facing unauthorized and version-mismatch UX to the merged backlog. |

## Current Action Ledger

| Priority | Owner | Action | Source |
| --- | --- | --- | --- |
| P1 | implementer | Keep the shell coverage and browser smoke lanes green. | R1-F10, R3-F02 |
| P1 | implementer | Keep release validation honest by validating the Tauri package boundary. | R3-F02 |
| P2 | implementer | Maintain repo-truth docs, codemaps, and roadmap files as part of release readiness. | R3-F01, R3-F04, R3-F05 |
| P2 | implementer | Keep governance docs linked from the root README. | R3-F04 |

## Round 4: Test-Layer Quality Review Integration

`Total findings: 5 | Must-fix: 3 | Bundle: 2 | Defer: 0 | Info: 0`
`Final Recommendation: Applied with caveats`
`Dissent Ledger: none`

| ID | Severity | Bucket | Summary | Category | Action Taken |
| --- | --- | --- | --- | --- | --- |
| R4-F01 | HIGH | Testing gap | Playwright assertions still target removed `Overview` tab and stale navigation behavior. | Must-fix | Added P0 remediation item TH-001 in `test-hardening-remediation-plan.md`. |
| R4-F02 | HIGH | Validation gap | Playwright config uses `npm run dev` in a pnpm-standardized repository. | Must-fix | Added P0 remediation item TH-002 to normalize runner bootstrap commands. |
| R4-F03 | HIGH | Capability gap | `pretest:e2e` fails because Playwright binary resolution is unstable in current setup. | Must-fix | Added P0 remediation item TH-003 for CI/runner hardening and fail-fast smoke lane. |
| R4-F04 | MEDIUM | Testing gap | Critical recon race-condition test remains skipped in shell suite. | Bundle | Added P1 remediation item TH-004 for deterministic unskip and race hardening. |
| R4-F05 | MEDIUM | Testing gap | Multiple shell tests rely on enlarged timeouts instead of deterministic synchronization. | Bundle | Added P1 remediation item TH-005 to remove timeout-driven instability. |
