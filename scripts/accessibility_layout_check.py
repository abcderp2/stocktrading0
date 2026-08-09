#!/usr/bin/env python3
"""Regression checks for form names and responsive market controls."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
CSS = ROOT / "assets" / "css" / "style.css"
FORM_TAGS = {"input", "select", "textarea"}


class AccessibilityParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.controls: list[dict[str, str | bool | None]] = []
        self.label_for: set[str] = set()
        self.label_stack: list[dict[str, object]] = []
        self.id_text: dict[str, list[str]] = {}
        self.id_stack: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        element_id = data.get("id", "")
        if element_id:
            self.id_text.setdefault(element_id, [])
            self.id_stack.append((tag, element_id))

        if tag == "label":
            label = {"for": data.get("for", ""), "controls": []}
            self.label_stack.append(label)
            if label["for"]:
                self.label_for.add(str(label["for"]))

        if tag in FORM_TAGS:
            input_type = data.get("type", "").lower() if tag == "input" else ""
            if input_type == "hidden":
                return
            wrapped = bool(self.label_stack)
            control = {
                "tag": tag,
                "id": element_id,
                "aria_label": data.get("aria-label", "").strip(),
                "aria_labelledby": data.get("aria-labelledby", "").strip(),
                "wrapped": wrapped,
            }
            self.controls.append(control)
            if self.label_stack:
                self.label_stack[-1]["controls"].append(control)

    def handle_endtag(self, tag: str) -> None:
        if tag == "label" and self.label_stack:
            self.label_stack.pop()
        for index in range(len(self.id_stack) - 1, -1, -1):
            if self.id_stack[index][0] == tag:
                del self.id_stack[index]
                break

    def handle_data(self, data: str) -> None:
        if not data.strip():
            return
        for _, element_id in self.id_stack:
            self.id_text[element_id].append(data)


def has_accessible_name(control: dict[str, str | bool | None], parser: AccessibilityParser) -> bool:
    if control["aria_label"]:
        return True
    control_id = str(control["id"] or "")
    if control_id and control_id in parser.label_for:
        return True
    if control["wrapped"]:
        return True
    labelledby = str(control["aria_labelledby"] or "")
    if labelledby:
        for ref in labelledby.split():
            if " ".join(parser.id_text.get(ref, [])).strip():
                return True
    return False


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")
    parser = AccessibilityParser()
    parser.feed(html)

    failures: list[str] = []
    unnamed = [f"{item['tag']}#{item['id'] or '(no-id)'}" for item in parser.controls if not has_accessible_name(item, parser)]
    if unnamed:
        failures.append("accessible name missing: " + ", ".join(unnamed))

    required_names = {
        "price-number": "株価 直接入力 円",
        "market-cap-number": "時価総額 直接入力 億円",
        "per-number": "PER 直接入力 倍",
        "volatility-number": "値動きの激しさ 直接入力 パーセント",
        "drift-number": "上がりやすさ 直接入力 パーセント",
        "mood-number": "市場ムード 直接入力",
    }
    for control_id, name in required_names.items():
        pattern = rf'<input\b[^>]*\bid="{re.escape(control_id)}"[^>]*\baria-label="{re.escape(name)}"'
        if not re.search(pattern, html):
            failures.append(f"expected accessible name is missing for {control_id}")

    base_rule = re.search(r"\.control-row\s*\{([^}]*)\}", css, re.S)
    if not base_rule:
        failures.append("base .control-row rule is missing")
    else:
        body = base_rule.group(1)
        if "grid-template-columns: minmax(0," not in body:
            failures.append("control-row columns must be shrinkable with minmax(0, ...)")
        if re.search(r"minmax\(\s*\d+px", body):
            failures.append("control-row must not restore fixed pixel minimum columns")

    if ".control-row > * { min-width: 0; }" not in css:
        failures.append("control-row children must keep min-width: 0")
    if "@media (max-width: 720px)" not in css or ".control-row { grid-template-columns: 1fr;" not in css:
        failures.append("mobile one-column control-row fallback is missing")

    if failures:
        for failure in failures:
            print(f"ERROR: {failure}")
        return 1
    print(f"OK: {len(parser.controls)} form controls have accessible names and control rows remain shrinkable")
    return 0


if __name__ == "__main__":
    sys.exit(main())
