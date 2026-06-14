# Bill Of Materials And Publish Gate

This document is the publish-readiness gate for the desktop checkout. It
captures the runtime/build inventory and the checks that must pass before the
repository is pushed to `origin` or a release tag is published.

## Runtime Components

### Frontend

- `react` `^19.2.6`
- `react-dom` `^19.2.6`
- `@tauri-apps/api` `^2.11.0`
- `src/App.tsx` owns the tabbed shell, evaluation workflow, recon guidance,
  report downloads, and last-opened snapshot restore.

### Desktop Runtime

- `tauri` `2`
- `reqwest` `0.12` with `json` and `rustls-tls`
- `serde` `1`
- `serde_json` `1`
- `tokio` `1`
- `src-tauri/src/lib.rs` owns config persistence, transport policy, local
  companion lifecycle, validation, and IPC boundaries.

### Tooling

- `vite` `^8.0.12`
- `vitest` `^4.1.7`
- `@vitest/coverage-v8` `^4.1.7`
- `@playwright/test` `^1.60.0`
- `axe-core` `^4.11.4`
- `typescript` `~6.0.2`
- `eslint` `^10.3.0`
- `@tauri-apps/cli` `^2.11.2`
- `@testing-library/react` `^16.3.2`
- `@testing-library/user-event` `^14.6.1`
- `@testing-library/jest-dom` `^6.9.1`
- `jsdom` `^29.1.1`

### External Integration

- Backend companion source of truth:
  `/Volumes/dev/Git-SCM/stealth-lightbeacon-phase-0a-0b`
- Pinned backend OpenAPI snapshot:
  `contracts/backend-api.openapi.json`

## Release Inputs

- [README.md](../README.md)
- [architecture.md](../architecture.md)
- [readme-CLI.md](../readme-CLI.md)
- [contributing.md](../contributing.md)
- [security-policy.md](../security-policy.md)
- [bill-of-materials.md](../bill-of-materials.md)
- [docs/roadmap/backlog.md](./roadmap/backlog.md)
- [docs/roadmap/implementation-roadmap.md](./roadmap/implementation-roadmap.md)
- [scripts/check_contract_sync.py](../scripts/check_contract_sync.py)
- [scripts/release_validate.py](../scripts/release_validate.py)
- [.github/workflows/release.yml](../.github/workflows/release.yml)

## Publish Readiness Checklist

Use this list as the gate before pushing `main` to `origin` or cutting a
release tag.

### Source And Tests

- [ ] `pnpm run test:coverage` passes with coverage above the repo threshold.
- [ ] `pnpm run test:e2e` passes.
- [ ] `pnpm run test:python` passes.
- [ ] `pnpm run test:rust` passes.
- [ ] `pnpm run check:contract-sync` passes.
- [ ] `pnpm run validate:release` passes end to end.
- [ ] Coverage deltas are intentional and tracked in the test suite, not just
      in ad hoc runs.

### Security And Privacy

- [ ] Search the staged diff and docs for secrets, tokens, private hostnames,
      and internal-only endpoints.
- [ ] Confirm `security-policy.md` still matches the current transport and
      token-handling behavior.
- [ ] Verify no new secrets are introduced in the frontend adapter or public
      docs.
- [ ] Confirm release notes and changelog entries do not leak private backend
      details.

### Documentation

- [ ] `README.md` reflects the current shell behavior and phase status.
- [ ] `architecture.md` and `readme-CLI.md` still describe the real command
      flow.
- [ ] `contributing.md` references the current validation lane.
- [ ] `bill-of-materials.md` and this file agree on the release inputs.
- [ ] Roadmap and backlog docs match the current completion ledger.

### Git And Delivery

- [ ] `git status --short` is clean except for the intended commit.
- [ ] The feature branch has conventional commits with focused scopes.
- [ ] The branch has been merged progressively toward `main` without regressing
      the shell, adapter, or release lane.
- [ ] `main` has been pushed to `origin`.
- [ ] The GitHub Actions release job has been monitored to completion after the
      push or tag.

## Evidence Notes

- Coverage and shell behavior are verified through `vitest` and Playwright
  runs in this checkout.
- Release behavior is verified through `scripts/release_validate.py` and the
  GitHub release workflow.
- Public docs are part of the release boundary and must stay synchronized with
  the code before publication.
