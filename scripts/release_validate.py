"""Run the desktop release validation lane against the sibling backend repo."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from check_contract_sync import backend_python_path, discover_backend_root


ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str], *, cwd: Path) -> None:
    print(f"+ ({cwd}) {' '.join(command)}")
    subprocess.run(command, cwd=cwd, check=True)


def main() -> None:
    backend_root = discover_backend_root()
    backend_python = backend_python_path(backend_root)

    run([sys.executable, "scripts/check_contract_sync.py"], cwd=ROOT)
    run([str(backend_python), "-m", "pytest"], cwd=backend_root)
    run(
        [str(backend_python), "-m", "pytest", "tests/contracts/test_openapi_contract.py"],
        cwd=ROOT,
    )
    run(
        ["npm", "run", "test", "--", "--run", "src/lib/desktop.test.ts", "src/__tests__/app-shell.test.tsx"],
        cwd=ROOT,
    )
    run(["npm", "run", "test:e2e"], cwd=ROOT)
    run(["cargo", "test", "--manifest-path", "src-tauri/Cargo.toml"], cwd=ROOT)
    run(["npm", "run", "build"], cwd=ROOT)
    run(["npm", "run", "tauri:build"], cwd=ROOT)

    print("release-validation: ok")


if __name__ == "__main__":
    main()
