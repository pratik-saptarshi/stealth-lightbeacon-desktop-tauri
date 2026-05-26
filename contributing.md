# Contributing

## Development Rules

- Keep the desktop repo thin. New backend semantics belong in the sibling
  backend repo, not in React or Tauri glue.
- Preserve the trust boundary:
  - React owns operator UX.
  - `src/lib/desktop.ts` owns the frontend adapter surface.
  - Rust owns config persistence, local companion lifecycle, validation, remote
    transport policy, and HTTP behavior.
- Follow TDD for boundary changes:
  - backend producer tests first when the contract changes
  - desktop consumer tests second
  - cross-repo validation before merge

## Local Workflow

1. Run `npm run check:contract-sync`.
2. Run `npm run test`.
3. Run `npm run test:python`.
4. Run `npm run test:rust`.
5. Run `npm run validate:release` for release-boundary work.

## Cross-Repo Changes

- If a change affects API semantics, update the backend producer contract first.
- Sync the pinned desktop OpenAPI snapshot only from the backend-generated
  artifact.
- Keep the desktop repo honest about companion packaging: this repo does not
  embed the backend runtime.

## Review Expectations

- Findings should focus on bugs, regressions, release risk, and missing tests.
- Update `backlog.md` and `plan-review-traceability.md` when a review changes
  the completion ledger or remediation backlog.
