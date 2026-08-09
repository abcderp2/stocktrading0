#!/usr/bin/env python3
"""Conservative, dependency-free security audit for the static site."""
from __future__ import annotations

import argparse
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".html", ".css", ".js", ".md", ".txt", ".xml", ".yml", ".yaml", ".py", ".gitignore"}
SECRET_PATTERNS = {
    "GitHub classic token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    "GitHub fine-grained token": re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    "OpenAI-style secret": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
}
DANGEROUS_JS = {
    "innerHTML": re.compile(r"\.innerHTML\b"),
    "outerHTML": re.compile(r"\.outerHTML\b"),
    "insertAdjacentHTML": re.compile(r"\.insertAdjacentHTML\s*\("),
    "document.write": re.compile(r"\bdocument\.write(?:ln)?\s*\("),
    "eval": re.compile(r"(^|[^A-Za-z0-9_$])eval\s*\("),
    "Function constructor": re.compile(r"\bnew\s+Function\s*\("),
}


def iter_text_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        if path.suffix.lower() in TEXT_SUFFIXES or path.name == ".gitignore":
            if path.stat().st_size <= 2_000_000:
                files.append(path)
    return files


def scan_current() -> list[str]:
    issues: list[str] = []
    for path in iter_text_files():
        rel = path.relative_to(ROOT)
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                issues.append(f"{label} pattern found in {rel}")
        if path.suffix == ".js":
            for label, pattern in DANGEROUS_JS.items():
                if pattern.search(text):
                    issues.append(f"dangerous DOM/code sink {label} found in {rel}")
        if path.suffix == ".html":
            if re.search(r"\son[a-z]+\s*=", text, re.IGNORECASE):
                issues.append(f"inline event handler found in {rel}")
            if re.search(r"<script(?![^>]*\bsrc=)[^>]*>", text, re.IGNORECASE):
                issues.append(f"inline script found in {rel}")
    return issues


def scan_history() -> list[str]:
    issues: list[str] = []
    try:
        commits = subprocess.run(
            ["git", "rev-list", "--all"], cwd=ROOT, check=True, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        ).stdout.splitlines()
    except (OSError, subprocess.CalledProcessError):
        print("WARNING: Git history is unavailable; skipped historical secret scan")
        return issues

    history_pattern = (
        r"gh[pousr]_[A-Za-z0-9]{20,}|"
        r"github_pat_[A-Za-z0-9_]{20,}|"
        r"sk-[A-Za-z0-9_-]{20,}|"
        r"BEGIN [A-Z ]*PRIVATE KEY|"
        r"AKIA[0-9A-Z]{16}"
    )
    for commit in commits[:300]:
        try:
            result = subprocess.run(
                ["git", "grep", "-I", "-n", "-E", history_pattern, commit, "--", "."],
                cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            )
        except OSError:
            break
        if result.returncode == 0 and result.stdout.strip():
            first = result.stdout.splitlines()[0]
            issues.append(f"secret-like pattern found in reachable history: {first[:240]}")
            break
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--history", action="store_true", help="also scan reachable Git history for high-signal secret patterns")
    args = parser.parse_args()

    issues = scan_current()
    if args.history:
        issues.extend(scan_history())

    if issues:
        for issue in issues:
            print(f"ERROR: {issue}")
        print(f"ERROR: security audit failed with {len(issues)} issue(s)")
        return 1
    print("OK: security audit passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
