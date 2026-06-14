# Implementation Queue

This queue translates the remaining open Beads into executable workstreams with validation gates. The queue is ordered by dependency risk, not by issue age.

## Active Workstreams

| Lane | Issues | Scope | Validation |
| --- | --- | --- | --- |
| A | `stealth-lightbeacon-desktop-tauri-iqr` | Overview tab summary of every tab and primary options | `npm test -- src/__tests__/app-shell.test.tsx src/__tests__/app-helpers.test.ts`, `npm run tauri:dev` |
| B | `stealth-lightbeacon-desktop-tauri-e94` | Standalone self-contained audits, report generation, and runtime packaging boundary | `cargo test --manifest-path src-tauri/Cargo.toml`, `npm test -- src/lib/desktop.test.ts src-tauri/src/lib.rs`, `npm run tauri:build` |
| C | `stealth-lightbeacon-desktop-tauri-n3z.3` | Recon workflow and remote-policy UX in the shell | `npm test -- src/__tests__/app-shell.test.tsx src/__tests__/app-helpers.test.ts`, `npm run tauri:dev` |
| D | `stealth-lightbeacon-desktop-tauri-n3z.3.3` and `stealth-lightbeacon-desktop-tauri-n3z.3.4` | Frontend coverage gate, Playwright smoke, and axe accessibility gate | `npm run test:coverage`, browser smoke, axe scan |

## Phase-to-Capability Matrix

| Phase | Capability area | Validation gate | Implementation task |
| --- | --- | --- | --- |
| Phase R2 | Recon workflow and remote-policy UX | `npm test -- src/__tests__/app-shell.test.tsx src/__tests__/app-helpers.test.ts` and `npm run tauri:dev` | `stealth-lightbeacon-desktop-tauri-n3z.3` |
| Phase R3 | Package-grade release validation | `pnpm run validate:release` after packaging lane stabilizes | `stealth-lightbeacon-desktop-tauri-e94` |
| Phase R4 | GitHub publication | GitHub release workflow and remote origin push checks | `stealth-lightbeacon-desktop-tauri-n3z.4` |

## Execution Order

1. Lane A and Lane B can run in parallel because they touch different subsystems.
2. Lane C can run alongside Lane B when UI changes stay inside `src/App.tsx` and the adapter boundary remains stable.
3. Lane D should follow the first UI and runtime changes so it can codify the settled shell contract instead of chasing churn.
4. Phase R2 is testable before R3.
5. Phase R3 must pass before Phase R4 begins.
6. R3 must pass before R4 begins.

## Done Criteria

- Every lane has a corresponding test-first change set.
- Every lane passes its local validation command before integration.
- The shell keeps one active workspace panel at a time.
- Standalone mode works without a backend API dependency for the supported validation flows.
- Root codemap stays in sync with any new roadmap artifacts.
