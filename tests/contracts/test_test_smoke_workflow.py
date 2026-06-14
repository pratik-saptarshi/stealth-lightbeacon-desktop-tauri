"""Keep the smoke workflow passing the Playwright grep argument correctly."""

from __future__ import annotations

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


class TestSmokeWorkflowTest(unittest.TestCase):
    def test_smoke_job_uses_direct_grep_argument(self) -> None:
        workflow = (ROOT / ".github" / "workflows" / "test-smoke.yml").read_text(
            encoding="utf-8"
        )

        self.assertIn(
            'run: pnpm run test:e2e --grep "keeps inactive panels hidden behind horizontal tabs|shows reports tab trace and report-download table"',
            workflow,
        )
        self.assertNotIn("pnpm run test:e2e -- --grep", workflow)
