# Contributing

## Development Rules

- Keep the desktop repo thin. New backend semantics belong in the sibling
  backend repo, not in React or Tauri glue.
- Use an isolated worktree for larger changes so the main checkout stays
  readable while docs, validation, and release work are in flight.
- Keep the public docs set current when shell behavior, runtime flow, or
  release packaging changes.
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
6. Refresh `changelog.md`, `README.md`, `architecture.md`, `readme-CLI.md`,
   `security-policy.md`, `bill-of-materials.md`, and the relevant codemaps
   before tagging a public release.

## Cross-Repo Changes

- If a change affects API semantics, update the backend producer contract first.
- Sync the pinned desktop OpenAPI snapshot only from the backend-generated
  artifact.
- Keep the desktop repo honest about companion packaging: this repo does not
  embed the backend runtime.
- Tag and publish releases only after the release validation lane passes.

## Review Expectations

- Findings should focus on bugs, regressions, release risk, and missing tests.
- Update `backlog.md` and `plan-review-traceability.md` when a review changes
  the completion ledger or remediation backlog.
- Keep `codemap.md` and the folder codemaps aligned with any structural
  changes so future agents can rehydrate the repo quickly.
