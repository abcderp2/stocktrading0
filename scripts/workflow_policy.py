#!/usr/bin/env python3
"""Keep GitHub Actions deliberately small, least-privileged, and credential-free."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"


def main() -> int:
    failures = 0
    for path in sorted(WORKFLOWS.glob("*.y*ml")):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT)
        checks = [
            ("uses:", "external or reusable Actions are not allowed"),
            ("pull_request_target", "pull_request_target is not allowed"),
            ("${{ secrets.", "workflow must not require repository secrets"),
            ("${{ github.token", "workflow must not reference github.token"),
            ("GH_TOKEN", "workflow must not expose a GitHub token through GH_TOKEN"),
            ("AUTHORIZATION: basic", "workflow must not construct Basic authorization headers"),
            (".extraheader", "workflow must not add Git authentication headers"),
            ("persist-credentials", "workflow must not persist checkout credentials"),
            ("contents: write", "workflow must not request contents: write"),
            ("permissions: write-all", "workflow must not request write-all"),
        ]
        for needle, message in checks:
            if needle in text:
                print(f"ERROR: {rel}: {message}")
                failures += 1
        if "permissions:" not in text or "contents: read" not in text:
            print(f"ERROR: {rel}: explicit contents: read permission is required")
            failures += 1
    if failures:
        return 1
    print("OK: workflow policy passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
