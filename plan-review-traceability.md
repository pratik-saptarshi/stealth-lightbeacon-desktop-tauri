# Plan Review Traceability

Review findings were integrated into the roadmap using four analysis buckets:
feature gaps, capability gaps, validation gaps, and testing gaps.

## Summary

`Total findings: 13 | Must-fix: 6 | Bundle: 6 | Defer: 0 | Info: 1`

`Final Recommendation: Auto-applied`

`Dissent Ledger: none`

## Traceability Table

| ID | Severity | Bucket | Summary | Category | Action Taken |
| --- | --- | --- | --- | --- | --- |
| R1-F01 | HIGH | Validation gap | Corrupted persisted config silently falls back to localhost. | Must-fix | Added to `Phase 1R` as fail-closed config handling plus recovery UX and tests. |
| R1-F02 | HIGH | Capability gap | Structured `ApiError` semantics are lost across the Rust/TS boundary. | Must-fix | Added to `Phase 1R` as typed error-envelope preservation with adapter and IPC tests. |
| R1-F03 | HIGH | Validation gap | React can construct contract-invalid evaluation payloads. | Must-fix | Added to `Phase 1R` as client validation plus shared contract checks. |
| R1-F04 | MEDIUM | Validation gap | `evaluation_id` is not URL-encoded. | Bundle | Added to `Phase 1R` as path-encoding hardening with regression tests. |
| R1-F05 | LOW | Feature gap | Docs overstate active-session persistence. | Informational | Corrected by the roadmap and related docs; active-session persistence is now an explicit decision in `Phase 1R`. |
| R1-F06 | HIGH | Capability gap | `BackendMode` is a label, not enforced policy. | Bundle | Pulled forward into `Phase 3` with an earlier safety-floor note in `Phase 1R`. |
| R1-F07 | MEDIUM | Capability gap | Manual OpenAPI snapshot can drift from runtime DTOs. | Bundle | Added automated contract sync and drift detection to `Phase 5`, with contract review at the start of every phase. |
| R1-F08 | HIGH | Capability gap | Submit remains available when `/capabilities` fails. | Must-fix | Added to `Phase 1R` as capability-gated submission and degraded-mode policy. |
| R1-F09 | HIGH | Capability gap | Polling dies on the first transient error and cannot resume. | Must-fix | Added to `Phase 1R` as retry/recovery behavior and persistence decision. |
| R1-F10 | HIGH | Testing gap | Frontend tests mock the desktop adapter and miss real IPC coverage. | Must-fix | Added a required Tauri IPC lane to `Phase 1R`. |
| R1-F11 | MEDIUM | Feature gap | Result and artifact routes exist in contract but not in desktop runtime. | Bundle | Split into `Phase 2A` and `Phase 2B` for end-to-end terminal workflow completion. |
| R1-F12 | MEDIUM | Feature gap | Recon exists in contract but is not wired in the desktop app. | Bundle | Kept as additive feature scope in `Phase 4` after base workflow and operability phases. |
| R1-F13 | HIGH | Capability gap | Local lifecycle, remote auth, version compatibility, TLS hardening, thin cache, and release hardening remain absent. | Bundle | Split across `Phase 3` and `Phase 5`, with safety-critical pieces moved earlier. |

## Bucket Split

- `Feature gaps`: `R1-F05`, `R1-F11`, `R1-F12`
- `Capability gaps`: `R1-F02`, `R1-F06`, `R1-F07`, `R1-F08`, `R1-F09`, `R1-F13`
- `Validation gaps`: `R1-F01`, `R1-F03`, `R1-F04`
- `Testing gaps`: `R1-F10`

## Key Decisions

- Result and artifact retrieval stay ahead of recon because a desktop app that
  submits and polls but cannot render terminal outputs is still incomplete.
- Hybrid operability moves ahead of recon because `local` and `remote` are
  already visible in the product surface and need honest behavior.
- Some hardening work is no longer treated as final-phase only. Where it blocks
  a trustworthy working app, it is now an earlier acceptance criterion.

## Action Items

| Priority | Owner | Action | Source finding |
| --- | --- | --- | --- |
| P1 | implementer | Execute `Phase 1R` before adding new feature scope. | R1-F01, R1-F02, R1-F03, R1-F08, R1-F09, R1-F10 |
| P1 | implementer | Add real Tauri IPC coverage and keep it green in every later phase. | R1-F10 |
| P1 | implementer | Complete terminal result and artifact flows before recon. | R1-F11 |
| P1 | implementer | Turn `BackendMode` and hybrid mode into real policy-driven runtime behavior. | R1-F06, R1-F13 |
| P2 | implementer | Add automated contract drift detection and release hardening workflow. | R1-F07, R1-F13 |
