# Agent Notes

- Read [codemap.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/codemap.md)
  first.
- Use the folder codemaps under `src/`, `src-tauri/`, and `src-tauri/src/`
  before structural edits.
- Treat
  [backlog.md](/Volumes/dev/Git-SCM/stealth-lightbeacon-desktop-tauri/docs/roadmap/backlog.md)
  as the source of truth for completion tracking and remaining remediation.
- This repo is an API-first desktop client. It is not the audit engine.
- React stays behind `src/lib/desktop.ts`.
- Rust in `src-tauri/src/lib.rs` is the trusted boundary for config
  persistence, local companion lifecycle, validation, and HTTP transport.
- The backend contract source of truth lives in the sibling backend repo and is
  pinned locally at `contracts/backend-api.openapi.json`.

## Repository Map

- `src/`: React shell for operator workflow, capability-gated submission,
  polling, result rendering, artifacts, and recon UX.
- `src/lib/desktop.ts`: typed Tauri adapter and error-normalization layer.
- `src-tauri/src/lib.rs`: trusted desktop runtime, local companion management,
  config persistence, transport policy, remote auth lookup, and IPC tests.
- `contracts/backend-api.openapi.json`: pinned backend OpenAPI snapshot consumed
  by desktop contract tests.
- `tests/contracts/`: contract assertions for the pinned OpenAPI snapshot.
- `scripts/check_contract_sync.py`: desktop-to-backend OpenAPI drift gate.
- `scripts/release_validate.py`: cross-repo validation lane, including Tauri
  packaging.

## Current Phase Reality

- Phase `0`, `1`, and `2` are implemented and validated across the desktop repo
  and the backend worktree at `/private/tmp/stealth-lightbeacon-phase-0a-0b`.
- Phase `3` is partial: recon transport exists in the adapter/runtime, but the
  operator workflow is not wired in `src/App.tsx`.
- Phase `4` is partial: local companion and remote policy substrate exist, but
  operator-facing auth and compatibility UX still needs completion.
- Phase `5` is partial: contract-sync and release validation exist, but GitHub
  publication plumbing is still missing in this checkout.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
