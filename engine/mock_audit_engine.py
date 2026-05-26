from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import time


def emit_event(run_id: str, stage: str, progress: int, message: str, exit_state: str | None = None) -> None:
    event = {
        "runId": run_id,
        "stage": stage,
        "progress": progress,
        "message": message,
        "timestampMs": int(time.time() * 1000),
        "exitState": exit_state,
    }
    print(json.dumps(event), flush=True)


def build_report(request: dict, run_id: str, exit_state: str) -> dict:
    return {
        "runId": run_id,
        "target": request["target"],
        "status": exit_state,
        "summary": {
            "criticalCount": 0 if exit_state == "success" else 1,
            "warningCount": 1,
            "phaseCount": 3,
        },
        "findings": [
            {
                "id": "mock-001",
                "severity": "warning" if exit_state == "success" else "critical",
                "category": "bootstrap",
                "title": "Mock contract execution completed",
                "location": request["target"],
            }
        ],
        "artifacts": [
            {"format": "json", "path": "report.json"},
            {"format": "markdown", "path": "report.md"},
        ],
    }


def run_command(request_path: Path, output_dir: Path) -> int:
    request = json.loads(request_path.read_text())
    run_id = f"mock-{int(time.time() * 1000)}"
    mock = request.get("mock", {})
    exit_behavior = mock.get("exitBehavior", "success")
    latency_ms = int(mock.get("latencyMs", 10))

    output_dir.mkdir(parents=True, exist_ok=True)

    phases = [
        ("queued", 0, "Mock scan accepted."),
        ("intake", 18, "Workspace and limits validated."),
        ("analysis", 62, "Mock findings generated."),
        ("export", 88, "Artifacts written to output directory."),
    ]

    for stage, progress, message in phases:
        emit_event(run_id, stage, progress, message)
        time.sleep(latency_ms / 1000)

    exit_map = {
        "success": (0, "success"),
        "failure": (1, "failure"),
        "budget_breach": (2, "budget_breach"),
    }
    code, exit_state = exit_map[exit_behavior]

    report = build_report(request, run_id, exit_state)
    (output_dir / "report.json").write_text(json.dumps(report, indent=2))
    (output_dir / "report.md").write_text(
        "\n".join(
            [
                f"# Mock Report for {request['target']}",
                "",
                f"- status: {exit_state}",
                f"- runId: {run_id}",
            ]
        )
    )

    emit_event(run_id, "completed", 100, f"Mock scan completed with {exit_state}.", exit_state)
    return code


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mock Lightbeacon audit engine")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run")
    run_parser.add_argument("--request", required=True, type=Path)
    run_parser.add_argument("--output", required=True, type=Path)

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command == "run":
        return run_command(args.request, args.output)
    return 1


if __name__ == "__main__":
    sys.exit(main())
