# Implementation Roadmap

This roadmap is now historical and completion-oriented rather than forward
planning. It records the phase model that was executed to make the desktop app
work end to end with the sibling backend companion.

Verified state on 2026-05-26:

- Desktop runtime features through release hardening are implemented locally.
- Backend companion work required by the original desktop plan is implemented in
  `/private/tmp/stealth-lightbeacon-phase-0a-0b`.
- The remaining work in this repo is operator-facing completion work plus
  release-operability cleanup.

See
[desktop-backend-contract.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/desktop-backend-contract.md)
for the verified interface map and
[backlog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/backlog.md)
for the current remediation backlog.

## Delivery Loop Used Per Phase

1. Start-of-phase review
   - Review the prior phase exit criteria.
   - Review current code in both repos, not only planning docs.
   - Review the pinned OpenAPI snapshot and the backend-generated artifact.
   - Review open findings in
     [plan-review-traceability.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/plan-review-traceability.md).
2. Test-first work
   - Add failing producer tests in the backend repo first.
   - Add failing consumer tests in the desktop repo second.
   - Add at least one integration check proving the repos still align.
3. Implementation
   - Make the smallest change set that satisfies the new tests.
   - Keep the backend authoritative for API semantics and run-state semantics.
   - Keep the desktop authoritative for local config, local snapshot cache, and
     trusted transport behavior.
4. Validation gate
   - Re-run targeted suites.
   - Re-run touched repo-wide suites.
   - Run at least one operator-visible smoke path for the boundary in question.

## Final Phase Ledger

| Phase | Status | Outcome |
| --- | --- | --- |
| 0A | Complete | Backend-generated OpenAPI plus desktop contract sync gate |
| 0B | Complete | Reusable backend service layer extracted from CLI |
| 1A | Complete | Backend HTTP bootstrap, health, capabilities, and error envelope |
| 1B | Complete | Evaluation submission, polling, and backend-owned job state |
| 2A | Complete | Terminal result route and desktop retrieval alignment |
| 2B | Complete | Artifact descriptor route and desktop artifact retrieval alignment |
| 3A | Complete | Managed local companion lifecycle |
| 3B | Partial | Remote auth, compatibility, and transport substrate exists, but operator-facing UX is incomplete |
| 4 | Partial | Recon route and transport exist, but React workflow wiring is incomplete |
| 5 | Partial | Contract sync and local validation exist, but publication plumbing is incomplete |

## Phase Summary

### Phase 0A

- Backend became the canonical producer of the OpenAPI document.
- Desktop gained a drift gate against the backend-produced artifact.

### Phase 0B

- Backend service seams were extracted from the CLI without regressing CLI
  behavior.

### Phase 1A And 1B

- Backend health and capability routes became real.
- Desktop bootstrap and evaluation polling were validated against the real
  backend.

### Phase 2A And 2B

- Terminal results and artifact descriptors became real producer-consumer
  boundaries instead of desktop-only placeholders.

### Phase 3A And 3B

- Local mode became a managed companion runtime.
- Remote mode became policy-driven with HTTPS enforcement, compatibility
  metadata, and Rust-only auth-token lookup, but the React shell still lacks
  explicit unauthorized and incompatibility UX.

### Phase 4

- Recon became a capability-gated backend route with desktop transport support.
- The remaining gap is operator workflow wiring in `src/App.tsx`.

### Phase 5

- Contract sync and cross-repo validation became part of the release boundary.
- Tauri package validation is now part of the release lane, but publication
  plumbing remains outstanding.

## Completion Definition

The original critical path is complete because:

1. the backend repo exposes the documented OpenAPI surface
2. the desktop repo's transport flows are validated against that backend
3. local and remote runtime policy exists inside Rust
4. contract, adapter, IPC, integration, and release validation are in place

The remaining desktop-completion work is tracked in `backlog.md`.

## Post-Completion Follow-Up

The remaining work is tracked in `backlog.md` under phases `R1` to `R3`:

- repo-truth and codemap refresh
- package-grade release validation
- GitHub publication plumbing
