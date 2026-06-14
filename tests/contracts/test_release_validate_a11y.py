"""Keep the desktop release lane running the pinned axe-core shell scan."""

from __future__ import annotations

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


class ReleaseValidateA11yTest(unittest.TestCase):
    def test_release_lane_runs_shell_a11y_gate(self) -> None:
        release_validate = (ROOT / "scripts" / "release_validate.py").read_text(encoding="utf-8")

        self.assertIn('tool("vitest")', release_validate)
        self.assertIn('node", "scripts/browser_smoke.mjs"', release_validate)
        self.assertIn('node", "scripts/validate_shell.mjs", "--axe"', release_validate)
        self.assertLess(
            release_validate.index('tool("vitest")'),
            release_validate.index("check_contract_sync.py"),
        )

    def test_release_lane_uses_local_tool_shims_instead_of_pnpm(self) -> None:
        release_validate = (ROOT / "scripts" / "release_validate.py").read_text(
            encoding="utf-8",
        )

        self.assertIn("tool(\"vitest\")", release_validate)
        self.assertIn("tool(\"playwright\")", release_validate)
        self.assertIn("tool(\"tsc\")", release_validate)
        self.assertIn("tool(\"vite\")", release_validate)
        self.assertIn("tool(\"tauri\")", release_validate)

        self.assertNotIn("[\"pnpm\", \"run\", \"validate:shell\"]", release_validate)
        self.assertNotIn("[\"pnpm\", \"run\", \"test:e2e\"]", release_validate)
        self.assertNotIn("[\"pnpm\", \"run\", \"build\"]", release_validate)
        self.assertNotIn("[\"pnpm\", \"run\", \"tauri:build\"]", release_validate)
