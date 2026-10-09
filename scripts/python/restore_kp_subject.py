#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""速懂·一句话 主语回填（结构式重写第四轮）。

背景：第一轮 R3 正则误将「X：是…」的 X 剥掉，产生无主句。
规则：一句话以「是」开头时，在定义节中找条目使 norm(name+content)==norm(body)，回填概念名。
"""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POINTS = ROOT / "content/kb/points"

STATS: Counter = Counter()
NO_MATCH: list[str] = []


def norm(s: str) -> str:
    return s.replace("*", "").replace(" ", "").strip().rstrip("。；;")


def main() -> None:
    changed = 0
    for p in sorted(POINTS.glob("kp-*.md")):
        old = p.read_text(encoding="utf-8")
        lines = old.splitlines()
        n = len(lines)
        d0 = next((k for k, l in enumerate(lines) if l.strip() == "## 定义"), -1)
        if d0 < 0:
            continue
        d1 = next((k for k in range(d0 + 1, n) if lines[k].startswith("## ")), n)
        defs = []
        for l in lines[d0 + 1 : d1]:
            m = re.match(r"^- \*\*(.+?)\*\*：(.+)$", l.strip())
            if m:
                rest = m.group(2)
                parts = re.split(r"[。]\s*\*{0,2}(?:作用|用于)\*{0,2}[：:]", rest, maxsplit=1)
                defs.append((m.group(1), parts[0]))
        hit = next((k for k, l in enumerate(lines) if re.match(r"^- \*\*一句话\*\*：是", l.strip())), -1)
        restored = False
        if defs and hit >= 0:
            m = re.match(r"^- \*\*一句话\*\*：(.+)$", lines[hit].strip())
            content = m.group(1)
            new_line = None
            content_tail = content[1:] if content.startswith("是") else content  # 去掉开头「是」
            for name, body in defs:
                # 取定义条目去掉「概念名前缀」后的尾部，再剥「是/是指」
                tail = body[len(name):] if norm(body).startswith(norm(name)) else body
                tail = re.sub(r"^是指?", "", tail.strip())
                if norm(tail) == norm(content_tail):
                    new_line = f"- **一句话**：{name}{content}"
                    break
            if new_line is None:
                # 形态二：定义条目本身以「是…」开头（无概念名前缀），一句话即其 body
                for name, body in defs:
                    if norm(body) == norm(content):
                        new_line = f"- **一句话**：{name}{content}"
                        break
            if new_line is None:
                NO_MATCH.append(f"{p.name}: {content[:60]}")
            else:
                lines[hit] = new_line
                restored = True
        # 收尾清理：空「具体理解」标签；标题前补空行
        cleaned = []
        for k, l in enumerate(lines):
            if l.strip() == "- **具体理解**：":
                nxt = next((lines[j].strip() for j in range(k + 1, n) if lines[j].strip()), "")
                if nxt.startswith("- **别搞混") or nxt.startswith("## "):
                    STATS["删空具体理解标签"] += 1
                    continue
            if l.startswith("## ") and cleaned and cleaned[-1].strip():
                cleaned.append("")
            cleaned.append(l)
        lines = cleaned
        text = "\n".join(lines).rstrip("\n") + "\n"
        if text != old:
            p.write_text(text, encoding="utf-8")
            changed += 1
            if restored:
                STATS["回填主语"] += 1
    print({"changed": changed}, dict(STATS.most_common()), "无匹配:", len(NO_MATCH))
    for x in NO_MATCH:
        print("  -", x)


if __name__ == "__main__":
    main()