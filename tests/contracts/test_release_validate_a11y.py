"""Keep the desktop release lane running the pinned axe-core shell scan."""

from __future__ import annotations

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


class ReleaseValidateA11yTest(unittest.TestCase):
    def test_release_lane_runs_shell_a11y_gate(self) -> None:
        release_validate = (ROOT / "scripts" / "release_validate.py").read_text(encoding="utf-8")

        self.assertIn("validate:shell", release_validate)
        self.assertLess(
            release_validate.index("validate:shell"),
            release_validate.index("check_contract_sync.py"),
        )
