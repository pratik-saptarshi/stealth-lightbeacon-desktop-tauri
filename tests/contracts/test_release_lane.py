"""Keep the release lane gated by tests and the workflows least-privilege."""

from __future__ import annotations

import json
import re
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def index_of_line(lines: list[str], needle: str) -> int:
    for index, line in enumerate(lines):
        if line.strip() == needle:
            return index
    return -1


class TestReleaseWorkflowTest(unittest.TestCase):
    def setUp(self) -> None:
        self.workflow = read(ROOT / ".github" / "workflows" / "release.yml")

    def test_release_verification_runs_between_install_and_publish(self) -> None:
        lines = self.workflow.splitlines()
        install = index_of_line(lines, "run: pnpm install --frozen-lockfile")
        verify = index_of_line(lines, "- name: Run release verification")
        publish = index_of_line(lines, "uses: tauri-apps/tauri-action@v2")

        self.assertGreaterEqual(install, 0)
        self.assertGreaterEqual(verify, 0)
        self.assertGreaterEqual(publish, 0)
        self.assertLess(install, verify)
        self.assertLess(verify, publish)

    def test_release_verification_step_runs_the_backend_free_script(self) -> None:
        lines = self.workflow.splitlines()
        verify = index_of_line(lines, "- name: Run release verification")
        publish = index_of_line(lines, "uses: tauri-apps/tauri-action@v2")

        run_index = index_of_line(lines[verify:publish], "run: pnpm run release:verify")
        self.assertGreaterEqual(
            run_index,
            0,
            "release verification must invoke pnpm run release:verify",
        )

    def test_release_verify_script_avoids_the_sibling_backend(self) -> None:
        package = json.loads(read(ROOT / "package.json"))
        script = package["scripts"].get("release:verify")

        self.assertIsNotNone(script, "package.json is missing release:verify")
        for command in (
            "pnpm run build",
            "pnpm run test",
            "pnpm run test:python",
            "pnpm run test:rust:unit",
        ):
            self.assertIn(command, script)
        self.assertNotRegex(script, r"pnpm run test:rust(?:\s|$)")
        self.assertNotIn("validate:release", script)
        self.assertNotIn("release_validate.py", script)


class TestSmokeWorkflowPrivilegeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.workflow = read(ROOT / ".github" / "workflows" / "test-smoke.yml")

    def test_workflow_grants_read_only_contents(self) -> None:
        self.assertRegex(
            self.workflow,
            r"(?m)^permissions:\n  contents: read$",
        )

    def test_checkout_does_not_persist_credentials(self) -> None:
        checkout = re.search(
            r"(?ms)^      - name: Checkout repository\n(.*?)(?=^      - name:)",
            self.workflow,
        )
        self.assertIsNotNone(checkout)
        self.assertIn("persist-credentials: false", checkout.group(1))


class TestTauriBuildContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.config = json.loads(read(ROOT / "src-tauri" / "tauri.conf.json"))
        self.package = json.loads(read(ROOT / "package.json"))

    def test_build_hooks_use_the_pnpm_package_manager(self) -> None:
        self.assertEqual(self.config["build"]["beforeBuildCommand"], "pnpm run build")
        self.assertEqual(self.config["build"]["beforeDevCommand"], "pnpm run dev")

    def test_tauri_version_matches_package_version(self) -> None:
        self.assertEqual(self.config["version"], self.package["version"])

    def test_cargo_version_matches_package_version(self) -> None:
        cargo = read(ROOT / "src-tauri" / "Cargo.toml")
        package_section = cargo.split("[package]", 1)[1].split("\n[", 1)[0]
        match = re.search(r'(?m)^version\s*=\s*"([^"]+)"', package_section)
        self.assertIsNotNone(match, "src-tauri/Cargo.toml has no package version")
        self.assertEqual(match.group(1), self.package["version"])


if __name__ == "__main__":
    unittest.main()
