"""Keep the Playwright native Tauri fixture from using an undefined page object."""

from __future__ import annotations

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


class PlaywrightNativeFixtureTest(unittest.TestCase):
    def test_native_tauri_fixture_waits_without_page_timeout(self) -> None:
        spec = (ROOT / "tests" / "playwright" / "app-shell.spec.ts").read_text(
            encoding="utf-8"
        )

        self.assertNotIn("await page.waitForTimeout(3000)", spec)
        self.assertIn("setTimeout(resolve, 3000)", spec)
