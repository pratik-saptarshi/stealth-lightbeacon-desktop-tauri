# Testing Coverage Uplift Roadmap

Beads remains the task source of truth. This note summarizes the current coverage uplift work and the tracked issue set for this repo.

## Consolidated Beads Track

- `stealth-lightbeacon-desktop-tauri-kg2` - `[epic] Testing coverage uplift to 90% across desktop client`

## Current Coverage Baseline

- Measured with `npm run test:coverage`
- Latest frontend coverage:
  - Statements: `90.05%`
  - Lines: `90.6%`
  - Functions: `90.73%`
  - Branches: `83.52%`

## Completed Test Slices

- App shell browser preview branch coverage
- Connection save failure branch coverage
- Submission failure branch coverage
- Terminal result load failure branch coverage
- Artifact load failure branch coverage
- Adapter normalization coverage for results, artifacts, snapshots, and error formatting
- Helper coverage for viewport, request validation, result formatting, and UI settings parsing
- Results tab run history and formatted report download coverage
- Workspace tab wrapping and visibility validation across viewport widths
- Settings color grid responsiveness validation

## Remaining Gap

- Statement coverage now clears the 90% target.
- Branch coverage remains below 90% and is the next measurable gap if the shell needs more hardening.

## Commands

- `npm test`
- `npm run test:coverage`
