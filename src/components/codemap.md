# src/components/

## Responsibility

This folder contains the React subviews that keep `App.tsx` focused on shell
orchestration. Each component owns one visible panel or table slice of the
desktop workflow.

## Design

- `SettingsTab.tsx` renders the desktop configuration controls and preference
  section.
- `CapabilitiesPanel.tsx` renders the capability summary and gating feedback.
- `EvaluationTable.tsx` renders the evaluation rows and terminal result actions.

## Integration

- Imported by: `src/App.tsx`.
- Test coverage: behavior is exercised through `src/__tests__/app-shell.test.tsx`
  and the shell coverage suite.
