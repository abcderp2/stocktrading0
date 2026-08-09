#!/usr/bin/env python3
"""Read-only structural checks for Stock Trading 0."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
REQUIRED = [
    "index.html", "404.html", "assets/css/style.css", "assets/js/market-engine.js", "assets/js/chart.js",
    "assets/js/storage.js", "assets/js/app.js", "README.md", "MAINTENANCE.md", "SECURITY.md", "CHANGELOG.md",
    "robots.txt", "llms.txt", "sitemap.xml", ".nojekyll", ".github/CODEOWNERS",
    "scripts/smoke_test.js", "scripts/check_site.py", "scripts/security_audit.py", "scripts/workflow_policy.py",
]


class SiteParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[tuple[str, str, str, str]] = []
        self.meta: list[dict[str, str]] = []
        self.inline_handlers: list[tuple[str, str]] = []
        self.inline_scripts = 0
        self.inline_styles = 0
        self.buttons_without_type = 0
        self.canvas_has_label = False
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        if data.get("id"):
            self.ids.add(data["id"])
        for key, value in attrs:
            if key in {"href", "src"} and value:
                self.refs.append((tag, key, value, data.get("rel", "")))
            if key.lower().startswith("on"):
                self.inline_handlers.append((tag, key))
        if tag == "meta":
            self.meta.append(data)
        if tag == "script" and not data.get("src"):
            self.inline_scripts += 1
        if tag == "style":
            self.inline_styles += 1
        if tag == "button" and data.get("type") != "button":
            self.buttons_without_type += 1
        if tag == "canvas" and data.get("id") == "market-chart" and data.get("aria-label"):
            self.canvas_has_label = True


def error(message: str) -> None:
    print(f"ERROR: {message}")


def warning(message: str) -> None:
    print(f"WARNING: {message}")


def main() -> int:
    failures = 0
    for relative in REQUIRED:
        if not (ROOT / relative).is_file():
            error(f"required file is missing: {relative}")
            failures += 1

    if not INDEX.is_file():
        return 1

    html = INDEX.read_text(encoding="utf-8")
    parser = SiteParser()
    parser.feed(html)

    if '<html lang="ja">' not in html:
        error("index.html must declare lang=ja")
        failures += 1
    if 'name="viewport"' not in html:
        error("viewport meta is missing")
        failures += 1
    if parser.inline_handlers:
        error(f"inline event handlers are forbidden: {parser.inline_handlers}")
        failures += 1
    if parser.inline_scripts:
        error("inline scripts are forbidden")
        failures += 1
    if parser.inline_styles:
        error("inline style blocks are forbidden")
        failures += 1
    if parser.buttons_without_type:
        error("all buttons must explicitly use type=button")
        failures += 1
    if not parser.canvas_has_label:
        error("market chart canvas needs an aria-label")
        failures += 1

    required_ids = {
        "market-chart", "chart-older", "chart-newer", "chart-zoom-in", "chart-zoom-out", "chart-reset",
        "export-data", "import-data", "new-world", "reset-data",
    }
    missing_ids = sorted(required_ids - parser.ids)
    if missing_ids:
        error(f"required interactive controls are missing: {missing_ids}")
        failures += 1

    if 'rel="canonical" href="https://abcderp2.github.io/stocktrading0/"' not in html:
        error("canonical public URL is missing or unexpected")
        failures += 1

    csp = ""
    for meta in parser.meta:
        if meta.get("http-equiv", "").lower() == "content-security-policy":
            csp = meta.get("content", "")
            break
    required_csp = [
        "default-src 'self'", "script-src 'self'", "connect-src 'none'", "object-src 'none'",
        "base-uri 'none'", "form-action 'none'", "worker-src 'none'",
    ]
    for directive in required_csp:
        if directive not in csp:
            error(f"CSP is missing required directive: {directive}")
            failures += 1

    runtime_tags = {"script", "img", "iframe", "audio", "video", "source"}
    for tag, attr, value, rel in parser.refs:
        parsed = urlparse(value)
        if parsed.scheme in {"http", "https"}:
            is_runtime = tag in runtime_tags or (tag == "link" and "stylesheet" in rel.lower().split())
            if is_runtime:
                error(f"external runtime resource is forbidden: {tag} {attr}={value}")
                failures += 1
            continue
        if parsed.scheme in {"mailto", "tel", "data"} or value.startswith("#"):
            continue
        path = parsed.path
        if not path or path.startswith("/"):
            continue
        target = (ROOT / path).resolve()
        try:
            target.relative_to(ROOT.resolve())
        except ValueError:
            error(f"local reference escapes repository: {value}")
            failures += 1
            continue
        if not target.exists():
            error(f"broken local reference: {value}")
            failures += 1

    runtime_files = [ROOT / "index.html", ROOT / "404.html", ROOT / "assets/css/style.css"] + sorted((ROOT / "assets/js").glob("*.js"))
    runtime_size = sum(path.stat().st_size for path in runtime_files if path.exists())
    if runtime_size > 350_000:
        warning(f"runtime text size is {runtime_size} bytes; consider keeping the first load lighter")

    css = (ROOT / "assets/css/style.css").read_text(encoding="utf-8")
    if "@media (max-width: 720px)" not in css:
        error("mobile breakpoint is missing")
        failures += 1
    if "@media (max-width: 430px)" not in css:
        error("narrow-phone breakpoint is missing")
        failures += 1
    if "prefers-reduced-motion" not in css:
        warning("prefers-reduced-motion handling is missing")
    if "min-height: 44px" not in css:
        warning("44px touch target baseline is missing")

    js_text = "\n".join(path.read_text(encoding="utf-8") for path in sorted((ROOT / "assets/js").glob("*.js")))
    if "devicePixelRatio" not in js_text:
        warning("chart does not appear to control high-DPI rendering cost")
    if not re.search(r"MAX_CANDLES\s*=\s*\d+", js_text):
        error("candle count limit is missing")
        failures += 1
    if "MAX_LOCAL_SAVE_BYTES" not in js_text:
        error("local save byte budget is missing")
        failures += 1

    if failures:
        print(f"ERROR: site checks failed with {failures} issue(s)")
        return 1
    print(f"OK: site checks passed; runtime text size={runtime_size} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
