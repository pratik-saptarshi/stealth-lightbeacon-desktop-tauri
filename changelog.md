# Changelog

## 2026-05-26

### Added

- Root and folder codemaps for the desktop repo, frontend adapter, and Tauri
  backend.
- `AGENTS.md` with repo-specific guidance for future agents.
- `readme-CLI.md` documenting local developer commands and validation flow.
- `plan-review-traceability.md` mapping review findings into roadmap actions.
- `integration_log.jsonl` capturing the plan-review integration decisions.

### Changed

- Rewrote `README.md` to reflect actual implementation status instead of the
  earlier Phase 1-only framing.
- Rewrote `architecture.md` to document the current transport boundary,
  bootstrap flow, and architectural drift.
- Reworked `backlog.md` into a validated phase tracker plus merged remediation
  backlog sourced from the current code review.
- Rewrote `implementation-roadmap.md` into a gated TDD-first execution plan with
  per-phase review, test-first work, implementation scope, validation gates,
  and exit criteria.

### Reviewed

- Audited the repo against the original phased plan.
- Ran an adversarial parallel review focused on transport correctness, contract
  drift, persistence scope, test realism, and remote-mode readiness.

### Notes

- This update is documentation and project-state alignment work. It does not add
  new runtime features beyond the codemap metadata and repo guidance files.
