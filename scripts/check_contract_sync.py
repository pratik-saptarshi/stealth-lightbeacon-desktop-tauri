"""Verify the backend-produced OpenAPI artifact matches the pinned desktop copy."""

from __future__ import annotations

import difflib
import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PINNED_CONTRACT = ROOT / "contracts" / "backend-api.openapi.json"


def discover_backend_root() -> Path:
    override = os.getenv("STEALTH_LIGHTBEACON_BACKEND_ROOT", "").strip()
    if override:
        return Path(override).expanduser().resolve()

    sibling = ROOT.parent / "stealth-lightbeacon"
    if (sibling / "scripts" / "export_openapi.py").exists():
        return sibling

    tmp_root = Path("/private/tmp")
    for candidate in sorted(tmp_root.glob("stealth-lightbeacon*")):
        if (candidate / "scripts" / "export_openapi.py").exists():
            return candidate

    raise SystemExit("Unable to locate the sibling stealth-lightbeacon backend repo.")


def backend_python_path(backend_root: Path) -> Path:
    override = os.getenv("STEALTH_LIGHTBEACON_BACKEND_PYTHON", "").strip()
    if override:
        return Path(override).expanduser().resolve()

    venv_python = backend_root / ".venv" / "bin" / "python"
    if venv_python.exists():
        return venv_python

    return Path(sys.executable)


def export_backend_contract(backend_root: Path) -> Path:
    return backend_root / "contracts" / "backend-api.openapi.json"


def compare_contracts(generated: Path, pinned: Path) -> None:
    generated_text = json.dumps(
        json.loads(generated.read_text(encoding="utf-8")),
        indent=2,
        sort_keys=True,
    ).splitlines()
    pinned_text = json.dumps(
        json.loads(pinned.read_text(encoding="utf-8")),
        indent=2,
        sort_keys=True,
    ).splitlines()
    if generated_text == pinned_text:
        print("contract-sync: ok")
        return

    diff = "\n".join(
        difflib.unified_diff(
            generated_text,
            pinned_text,
            fromfile=str(generated),
            tofile=str(pinned),
            lineterm="",
        )
    )
    raise SystemExit(f"contract-sync: drift detected\n{diff}")


def main() -> None:
    backend_root = discover_backend_root()
    generated = export_backend_contract(backend_root)
    compare_contracts(generated, PINNED_CONTRACT)


if __name__ == "__main__":
    main()
