# Desktop Architecture

This repository implements the desktop operator client for Stealth Lightbeacon.
The backend companion executes evaluations and remains authoritative for job
state, terminal results, artifacts, recon output, and the canonical OpenAPI
contract. The desktop client is a thin but trusted UX and transport layer.

## Runtime Topology

1. React renders connection setup, evaluation submission, polling, terminal
   result, artifacts, recon, and snapshot restore.
2. The frontend calls Tauri commands through `src/lib/desktop.ts`.
3. Rust validates local input, persists local settings, manages the optional
   local companion process, and performs HTTP requests to the backend API.
4. The backend API owns evaluation lifecycle state and contract semantics.

## Cross-Repo Reality

The earlier plan assumed the backend substrate did not exist yet. That is now
outdated. The validated backend worktree
`/private/tmp/stealth-lightbeacon-phase-0a-0b` exposes:

- generated OpenAPI at `/openapi.json`
- bootstrap routes `/health` and `/capabilities`
- evaluation submission and polling
- terminal result and artifact routes
- recon route
- auth and compatibility metadata

This desktop repo is therefore no longer blocked on the original early phases,
but some operator-facing completion work remains in this repo.

## Trust Boundaries

- React is untrusted for filesystem access, credential storage, and transport
  policy.
- Rust is the trusted desktop boundary for config validation, persistence,
  local companion lifecycle, remote auth-token lookup, and transport error
  normalization.
- The backend is the source of truth for evaluation status, terminal outputs,
  artifacts, recon output, and compatibility policy.

## Current Runtime Flow

1. Tauri starts and loads persisted `backend-config.json` from the app config
   directory.
2. React requests the saved config and any terminal snapshot from Rust.
3. React checks backend reachability and capability data.
4. In local mode, Rust can discover and start the sibling backend companion and
   wait for an `ok` health state before continuing.

### Evaluation Lifecycle

1. The operator edits backend config and saves it through Tauri.
2. The operator submits an evaluation request from the React form.
3. Rust validates the payload and sends `POST /evaluations`.
4. React stores the accepted evaluation ID in memory and polls
   `GET /evaluations/{evaluation_id}` until `terminal=true`.
5. React retrieves `GET /evaluations/{evaluation_id}/result` and
   `GET /evaluations/{evaluation_id}/artifacts`.
6. Rust persists only the thin last-opened terminal snapshot needed for a fast
   restore, not a full desktop history store.
7. Recon transport exists through `POST /recon`, but the React shell does not
   yet expose an operator workflow for it.

## Contract Boundary

The contract source of truth is the backend's `/openapi.json`, exported to
`contracts/backend-api.openapi.json` in the backend repo and pinned here at
`contracts/backend-api.openapi.json`. The desktop repo validates its copy
against the backend producer with `npm run check:contract-sync`.

## Implemented Surface

- backend config persistence
- health and capability checks
- evaluation create and status polling
- terminal result retrieval and rendering
- artifact retrieval and rendering
- recon transport support in the desktop adapter and Rust runtime
- local companion startup, readiness, degraded-state, and shutdown handling
- remote HTTPS enforcement, version header injection, and Rust-only auth-token
  lookup
- last-opened terminal snapshot persistence
- cross-repo release validation including Tauri packaging

## Remaining Gaps

- Recon is not yet wired into `src/App.tsx`.
- Remote auth-required and compatibility-mismatch handling exists at the
  transport layer, but operator-facing UX is still thin.
- GitHub publication is not yet configured in this local checkout because no
  `origin` remote exists.
- The desktop package still depends on a separately versioned backend runtime;
  it does not embed Python or the audit engine.
- Long-term Rust decomposition is still desirable because `src-tauri/src/lib.rs`
  remains monolithic.

## Explicit Exclusions

- No audit-engine execution inside the frontend.
- No desktop-authoritative artifact store or full run-history database.
- No MCP configuration endpoints or agent-card surface in the desktop app.
