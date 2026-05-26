# Desktop And Backend Contract Alignment

This document maps the contract and lifecycle work required in
`/Volumes/dev/Git-SCM/stealth-lightbeacon` so it can integrate honestly with
the desktop app in this repo.

Verified on 2026-05-26:

- The desktop repo is implemented against an HTTP/OpenAPI backend.
- The sibling backend repo is implemented as a Typer CLI audit engine with file
  outputs, not as an HTTP companion.
- The remaining work is therefore not primarily a desktop feature backlog. It
  is a producer-consumer integration program.

## Current Interface Reality

### Desktop Repo Expects

The desktop repo already consumes or plans around these routes:

- `GET /health`
- `GET /capabilities`
- `POST /evaluations`
- `GET /evaluations/{evaluation_id}`
- `GET /evaluations/{evaluation_id}/result`
- `GET /evaluations/{evaluation_id}/artifacts`
- `POST /recon`
- `/openapi.json` as contract source of truth

The pinned snapshot is
[contracts/backend-api.openapi.json](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/contracts/backend-api.openapi.json).

### Backend Repo Actually Exposes

The sibling repo currently exposes:

- `python main.py evaluate ...` as the public entrypoint
- env-driven CLI contract such as `SLB_TARGET_URL`, `SLB_AUTH_TOKEN`,
  `SLB_AUDITS`, and `SLB_FAIL_ON_CRITICAL`
- file-based report outputs
- recon as an in-process helper and CLI flag pair `--recon` and
  `--recon-auto`

It does not yet expose an HTTP server, OpenAPI artifact, evaluation job model,
artifact descriptor route, or desktop-facing recon route.

## Required OpenAPI 3.1 Contract

The backend repo needs to become the producer for a shared OpenAPI 3.1 contract
covering at least:

### Core Routes

- `GET /health`
  - response: `status`, `service`, `apiVersion`, `appVersion?`
- `GET /capabilities`
  - response: `apiMode`, `evaluationProfiles[]`, `outputFormats[]`,
    `supportsRecon`, `supportsArtifacts`
- `POST /evaluations`
  - request: desktop-compatible evaluation request
  - response: `evaluationId`, `status`, `acceptedAt?`
- `GET /evaluations/{evaluation_id}`
  - response: `evaluationId`, `status`, `stage?`, `progressPercent?`,
    `message?`, `exitState?`, `terminal`
- `GET /evaluations/{evaluation_id}/result`
  - response: terminal result DTO usable by the existing desktop renderer
- `GET /evaluations/{evaluation_id}/artifacts`
  - response: array of artifact descriptors
- `POST /recon`
  - response: backend-defined advisory recon DTO

### Shared Cross-Cutting Schemas

- `ApiError`
  - `code`
  - `message`
  - `status?`
  - `details?`
- `ApiModeResponse`
  - `mode`
  - `baseUrl`
  - `transport`
  - `apiVersion`
  - `supportsRemote`

## Contract Gaps

### Feature Gaps

- No backend HTTP route surface exists for the desktop's implemented workflow.
- No asynchronous evaluation lifecycle exists with backend-owned
  `evaluationId`s.
- No artifact descriptor or download contract exists.
- No desktop-facing recon route exists.

### Capability Gaps

- No service layer is separated cleanly from the Typer CLI.
- No long-running local companion process exists on the desktop's default
  loopback target.
- No backend-owned run-state store exists for polling, result retrieval, and
  artifact lookup.
- No remote auth, version negotiation, or transport-policy surface exists.

### Validation Gaps

- The desktop snapshot claims `/openapi.json` as source of truth, but the
  backend repo does not serve or generate it.
- Desktop request fields do not map cleanly onto the backend CLI request model.
- Desktop result schema does not match the backend's current normalized report
  payload.
- Desktop recon schema does not match the backend helper's current output.
- `SLB_AUTH_TOKEN` currently means audited-target auth, not backend API auth.

### Testing Gaps

- No backend HTTP route tests exist.
- No OpenAPI producer snapshot exists in the backend repo.
- No cross-repo producer-consumer integration harness exists.
- No companion lifecycle test lane exists.

## Lifecycle Management Needs

### Local Companion

To make `local` mode real, the backend repo must support:

- process startup on the loopback target
- readiness and degraded health reporting
- bounded shutdown behavior
- stable artifact storage discoverable by evaluation ID
- log and crash semantics that the desktop can surface meaningfully

To consume that safely, the desktop repo must support:

- startup probing and retry windows
- degraded and recovery UI states
- shutdown handling
- thin local snapshot persistence only

### Remote API

To make `remote` mode real, both repos must agree on:

- backend API authentication semantics
- storage of auth references versus secrets
- TLS and plaintext policy
- compatibility/version mismatch responses
- unsupported-capability behavior

## TDD Program Shape

The delivery order is:

1. Contract re-baseline
2. Backend service extraction
3. Backend HTTP skeleton plus `health` and `capabilities`
4. Evaluation job model
5. Result route
6. Artifact route
7. Local companion lifecycle
8. Remote auth and compatibility policy
9. Recon API
10. Release hardening and contract-sync automation

Each phase begins with:

- code review of both repos
- failing backend tests
- failing desktop consumer tests
- one explicit integration check

Each phase ends with:

- targeted suites green
- previously green suites re-run
- one manual smoke path

## Decision Constraint

There are only two honest product directions:

1. Make `/Volumes/dev/Git-SCM/stealth-lightbeacon` grow an HTTP/OpenAPI
   companion layer that matches the desktop contract.
2. Redesign the desktop repo to invoke the CLI directly and abandon the current
   HTTP/OpenAPI contract.

This roadmap assumes direction `1`, because that is the product surface already
implemented in the desktop repo.
