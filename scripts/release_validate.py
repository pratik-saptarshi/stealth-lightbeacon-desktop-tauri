"""Run the desktop release validation lane against the sibling backend repo."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from check_contract_sync import backend_python_path, discover_backend_root


ROOT = Path(__file__).resolve().parents[1]


def tool(name: str) -> str:
    suffix = ".cmd" if os.name == "nt" else ""
    return str(ROOT / "node_modules" / ".bin" / f"{name}{suffix}")


def run(command: list[str], *, cwd: Path) -> None:
    print(f"+ ({cwd}) {' '.join(command)}")
    subprocess.run(command, cwd=cwd, check=True)


def main() -> None:
    backend_root = discover_backend_root()
    backend_python = backend_python_path(backend_root)

    run([tool("vitest"), "run", "src", "--coverage"], cwd=ROOT)
    run(["node", "scripts/browser_smoke.mjs"], cwd=ROOT)
    run(["node", "scripts/validate_shell.mjs", "--axe"], cwd=ROOT)
    run([sys.executable, "scripts/check_contract_sync.py"], cwd=ROOT)
    run([str(backend_python), "-m", "pytest"], cwd=backend_root)
    run(
        [str(backend_python), "-m", "pytest", "tests/contracts/test_openapi_contract.py"],
        cwd=ROOT,
    )
    run(
        [tool("vitest"), "run", "src/lib/desktop.test.ts", "src/__tests__/app-shell.test.tsx"],
        cwd=ROOT,
    )
    run([tool("playwright"), "test"], cwd=ROOT)
    run(["cargo", "test", "--manifest-path", "src-tauri/Cargo.toml"], cwd=ROOT)
    run([tool("tsc"), "-b"], cwd=ROOT)
    run([tool("vite"), "build"], cwd=ROOT)
    run([tool("tauri"), "build", "--bundles", "app"], cwd=ROOT)

    print("release-validation: ok")


if __name__ == "__main__":
    main()
