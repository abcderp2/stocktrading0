#!/usr/bin/env python3
"""Read-only structural checks for 株価あそび場."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
LLMS = ROOT / "llms.txt"
REQUIRED = [
    "index.html", "404.html", "assets/css/style.css", "assets/js/market-engine.js", "assets/js/chart.js",
    "assets/js/storage.js", "assets/js/app.js", "README.md", "MAINTENANCE.md", "SECURITY.md", "CHANGELOG.md",
    "robots.txt", "llms.txt", "sitemap.xml", ".nojekyll", ".github/CODEOWNERS",
    "scripts/smoke_test.js", "scripts/check_site.py", "scripts/accessibility_layout_check.py",
    "scripts/security_audit.py", "scripts/workflow_policy.py",
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
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()
        self.canvas_has_label = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        element_id = data.get("id", "")
        if element_id:
            if element_id in self.ids: self.duplicate_ids.add(element_id)
            self.ids.add(element_id)
        for key, value in attrs:
            if key in {"href", "src"} and value: self.refs.append((tag, key, value, data.get("rel", "")))
            if key.lower().startswith("on"): self.inline_handlers.append((tag, key))
        if tag == "meta": self.meta.append(data)
        if tag == "script" and not data.get("src"): self.inline_scripts += 1
        if tag == "style": self.inline_styles += 1
        if tag == "button" and data.get("type") != "button": self.buttons_without_type += 1
        if tag == "canvas" and data.get("id") == "market-chart" and data.get("aria-label"): self.canvas_has_label = True


def main() -> int:
    failures: list[str] = []
    for relative in REQUIRED:
        if not (ROOT / relative).is_file(): failures.append(f"required file is missing: {relative}")
    if not INDEX.is_file():
        print("ERROR: index.html missing"); return 1

    html = INDEX.read_text(encoding="utf-8")
    parser = SiteParser(); parser.feed(html)
    if '<html lang="ja">' not in html: failures.append("index.html must declare lang=ja")
    if 'name="viewport"' not in html: failures.append("viewport meta is missing")
    if parser.inline_handlers: failures.append(f"inline event handlers are forbidden: {parser.inline_handlers}")
    if parser.inline_scripts: failures.append("inline scripts are forbidden")
    if parser.inline_styles: failures.append("inline styles are forbidden")
    if parser.buttons_without_type: failures.append("all buttons must explicitly use type=button")
    if parser.duplicate_ids: failures.append("duplicate ids: " + ", ".join(sorted(parser.duplicate_ids)))
    if not parser.canvas_has_label: failures.append("market chart canvas needs an aria-label")

    required_ids = {
        "market-chart", "market-date", "timeframe-controls", "range-controls", "range-20y", "detail-date", "detail-open", "detail-high", "detail-low", "detail-close", "detail-volume",
        "stat-52-high", "stat-52-low", "stat-20-high", "stat-20-low", "stat-volume", "price-slider", "price-number", "step-1", "buy-button", "sell-button",
        "calendar-mode", "chart-fit", "undo-action", "reset-data", "export-data", "import-data", "event-message",
    }
    missing_ids = sorted(required_ids - parser.ids)
    if missing_ids: failures.append(f"required interactive controls are missing: {missing_ids}")
    if 'value="テスト企業"' not in html or 'id="current-price">¥1,000<' not in html: failures.append("initial test company / 1000-yen presentation is missing")
    for label in ("日足", "週足", "月足", "1か月", "3か月", "1年", "5年", "20年", "全期間", "出来高", "ありえない事件を起こす"):
        if label not in html: failures.append(f"chart or fiction label is missing: {label}")
    if 'rel="canonical" href="https://abcderp2.github.io/stocktrading0/"' not in html: failures.append("canonical public URL is missing")
    if 'href="https://github.com/abcderp2/stocktrading0"' not in html: failures.append("public GitHub repository link is missing")
    if 'href="llms.txt"' not in html: failures.append("AI public policy link is missing")
    if LLMS.is_file():
        llms = LLMS.read_text(encoding="utf-8")
        for marker in ["English", "日本語", "Welcome", "歓迎する利用", "Financial boundary", "金融情報としての境界"]:
            if marker not in llms: failures.append(f"llms.txt bilingual policy marker missing: {marker}")

    csp = next((m.get("content", "") for m in parser.meta if m.get("http-equiv", "").lower() == "content-security-policy"), "")
    for directive in ["default-src 'self'", "script-src 'self'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "worker-src 'none'"]:
        if directive not in csp: failures.append(f"CSP missing: {directive}")

    runtime_tags = {"script", "img", "iframe", "audio", "video", "source"}
    for tag, attr, value, rel in parser.refs:
        parsed = urlparse(value)
        if parsed.scheme in {"http", "https"}:
            is_runtime = tag in runtime_tags or (tag == "link" and "stylesheet" in rel.lower().split())
            if is_runtime: failures.append(f"external runtime resource is forbidden: {tag} {attr}={value}")
            continue
        if parsed.scheme in {"mailto", "tel", "data"} or value.startswith("#"): continue
        path = parsed.path
        if not path or path.startswith("/"): continue
        target = (ROOT / path).resolve()
        try: target.relative_to(ROOT.resolve())
        except ValueError: failures.append(f"local reference escapes repository: {value}"); continue
        if not target.exists(): failures.append(f"broken local reference: {value}")

    runtime_files = [ROOT / "index.html", ROOT / "404.html", ROOT / "assets/css/style.css"] + sorted((ROOT / "assets/js").glob("*.js"))
    runtime_size = sum(path.stat().st_size for path in runtime_files if path.exists())
    if runtime_size > 420_000: failures.append(f"runtime text size too large: {runtime_size}")
    css = (ROOT / "assets/css/style.css").read_text(encoding="utf-8")
    for needle in ["@media (max-width: 720px)", "@media (max-width: 430px)", "prefers-reduced-motion", "min-height: 44px"]:
        if needle not in css: failures.append(f"responsive/accessibility CSS contract missing: {needle}")

    js_files = sorted((ROOT / "assets/js").glob("*.js"))
    js_text = "\n".join(path.read_text(encoding="utf-8") for path in js_files)
    engine_text = (ROOT / "assets/js/market-engine.js").read_text(encoding="utf-8")
    chart_text = (ROOT / "assets/js/chart.js").read_text(encoding="utf-8")
    storage_text = (ROOT / "assets/js/storage.js").read_text(encoding="utf-8")
    app_text = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")
    for needle in ["devicePixelRatio", "MAX_LOCAL_SAVE_BYTES", "SCHEMA_VERSION = 4", "START_PRICE = 1000", "HISTORY_YEARS = 20", "aggregateCandles", "filterCandlesByRange", "marketStats", "volume"]:
        if needle not in js_text: failures.append(f"runtime contract missing: {needle}")
    match = re.search(r"MAX_CANDLES\s*=\s*(\d+)", engine_text)
    if not match or int(match.group(1)) < 7300: failures.append("MAX_CANDLES must cover about 20 years of daily history")
    if "selectAtClientX(event.clientX" not in chart_text or "pointermove" not in chart_text: failures.append("continuous chart scrub selection is missing")
    if "Math.min(320" not in chart_text: failures.append("chart visible-candle rendering cap is missing")
    if "stocktrading0.state.v4" not in storage_text or "stocktrading0.state.v3" not in storage_text: failures.append("v4 storage or v3 legacy migration key is missing")
    if "window.confirm" in app_text: failures.append("reset must be immediate and must not use window.confirm")
    if "UNDO_LIMIT = 3" not in app_text: failures.append("long-history undo memory cap is missing")

    if failures:
        for failure in failures: print("ERROR:", failure)
        return 1
    print(f"OK: site checks passed; runtime text size={runtime_size} bytes")
    return 0

if __name__ == "__main__": sys.exit(main())
