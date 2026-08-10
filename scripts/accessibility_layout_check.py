#!/usr/bin/env python3
"""Regression checks for accessible form names and responsive controls."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
CSS = ROOT / "assets/css/style.css"
FORM_TAGS = {"input", "select", "textarea"}

class Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.controls: list[dict[str, str | bool]] = []
        self.label_depth = 0
        self.label_for: set[str] = set()
    def handle_starttag(self, tag, attrs):
        data = {k: v or "" for k, v in attrs}
        if tag == "label":
            self.label_depth += 1
            if data.get("for"): self.label_for.add(data["for"])
        if tag in FORM_TAGS and data.get("type", "").lower() != "hidden":
            self.controls.append({"tag": tag, "id": data.get("id", ""), "aria": data.get("aria-label", "").strip(), "wrapped": self.label_depth > 0})
    def handle_endtag(self, tag):
        if tag == "label" and self.label_depth: self.label_depth -= 1


def main() -> int:
    html = INDEX.read_text(encoding="utf-8"); css = CSS.read_text(encoding="utf-8"); parser = Parser(); parser.feed(html); failures = []
    for control in parser.controls:
        if not control["aria"] and not control["wrapped"] and control["id"] not in parser.label_for:
            failures.append(f"accessible name missing: {control['tag']}#{control['id'] or '(no-id)'}")
    required_names = {
        "price-number": "株価 直接入力 円", "market-cap-number": "時価総額 直接入力 億円", "per-number": "PER 直接入力 倍",
        "volatility-number": "値動きの激しさ 直接入力 パーセント", "drift-number": "上がりやすさ 直接入力 パーセント", "mood-number": "市場ムード 直接入力",
    }
    for control_id, name in required_names.items():
        pattern = rf'<input\b[^>]*\bid="{re.escape(control_id)}"[^>]*\baria-label="{re.escape(name)}"'
        if not re.search(pattern, html): failures.append(f"expected accessible name missing for {control_id}")
    base_rule = re.search(r"\.control-row\s*\{([^}]*)\}", css, re.S)
    if not base_rule or "grid-template-columns: minmax(0," not in base_rule.group(1): failures.append("control-row columns must use shrinkable minmax(0, ...)")
    if ".control-row > * { min-width: 0; }" not in css: failures.append("control-row children must keep min-width: 0")
    if "@media (max-width: 720px)" not in css or ".control-row { grid-template-columns: 1fr;" not in css: failures.append("mobile one-column control-row fallback missing")
    for class_name in ["timeframe-button", "range-button"]:
        if class_name not in html: failures.append(f"chart selector missing: {class_name}")
    if failures:
        for failure in failures: print("ERROR:", failure)
        return 1
    print(f"OK: {len(parser.controls)} form controls have accessible names and responsive controls remain shrinkable")
    return 0

if __name__ == "__main__": sys.exit(main())
