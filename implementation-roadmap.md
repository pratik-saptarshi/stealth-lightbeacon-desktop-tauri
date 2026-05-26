# Implementation Roadmap

## Phase 0

1. Reset desktop architecture docs around the backend API contract.
2. Pin a local OpenAPI snapshot and add contract tests for required paths and schemas.

## Phase 1

1. Replace mock scan commands with Rust HTTP adapter commands.
2. Persist backend mode, base URL, and timeout in the app config directory.
3. Add React connection, submission, and polling states.
4. Validate with:
   - Rust adapter tests against a local stub server
   - React tests for bootstrap, save, submit, and poll flows
   - Python contract tests for the pinned OpenAPI snapshot

## Phase 2

1. Add result and artifact retrieval commands.
2. Replace placeholder dock content with terminal report UI.

## Phase 3

1. Add recon request/response wiring without AI or MCP UX language.
2. Keep recon capability data sourced from `/capabilities`.

## Phase 4

1. Add local companion lifecycle management in Rust.
2. Add remote auth and version-compatibility states.

## Phase 5

1. Keep persistence thin.
2. Harden retry, TLS, and release workflows.
