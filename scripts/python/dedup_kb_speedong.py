#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""速懂去重（结构式重写第三轮）：速懂节不应整句复制定义节内容。

规则：
R1 一句话尾部「作用：Y。」与定义条目作用句重复 → 删该句（定义节保留答卷句）。
R2 具体理解 bullet 与定义条目整句重复 → 删 bullet；全空则删「具体理解」标签。
R3 「X：X是…」概念名重复 → 「X是…」。
"""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POINTS = ROOT / "content/kb/points"

STATS: Counter = Counter()


def norm(s: str) -> str:
    return s.replace("*", "").replace(" ", "").strip()


def main() -> None:
    changed = 0
    for p in sorted(POINTS.glob("kp-*.md")):
        old_text = p.read_text(encoding="utf-8")
        lines = old_text.splitlines()
        n = len(lines)

        def find_sec(name: str) -> tuple[int, int]:
            start = next((k for k, l in enumerate(lines) if l.strip() == f"## {name}"), -1)
            if start < 0:
                return -1, -1
            end = next((k for k in range(start + 1, n) if lines[k].startswith("## ")), n)
            return start, end

        d0, d1 = find_sec("定义")
        defs: list[tuple[str, str, str]] = []  # (name, body, effect)
        if d0 >= 0:
            for l in lines[d0 + 1 : d1]:
                m = re.match(r"^- \*\*(.+?)\*\*：(.+)$", l.strip())
                if m:
                    rest = m.group(2)
                    parts = re.split(r"[。]\s*\*{0,2}作用\*{0,2}[：:]", rest, maxsplit=1)
                    body = parts[0]
                    eff = parts[1].rstrip("。") if len(parts) > 1 else ""
                    defs.append((m.group(1), body, eff))
        s0 = next((k for k, l in enumerate(lines) if l.strip() == "## 速懂"), -1)
        if s0 < 0 or not defs:
            continue
        s1 = next((k for k in range(s0 + 1, n) if lines[k].startswith("## ")), n)

        def_full = set()
        for name, body, eff in defs:
            full = f"{name}：{body}"
            if eff:
                full += f"作用：{eff}。"
            def_full.add(norm(full))
        def_effs = {norm(e) for _, _, e in defs if e}
        def_bodies = {norm(body): name for name, body, _ in defs}

        out = list(lines[:s0])
        i = s0
        changed_speed = False
        while i < s1:
            l = lines[i]
            s = l.strip()
            # 具体理解块：收集 bullets
            if s.startswith("- **具体理解**"):
                j = i + 1
                kept: list[str] = []
                while j < s1:
                    t = lines[j].strip()
                    if not t:
                        j += 1
                        continue
                    if t.startswith("- ") or t.startswith("  - "):
                        if norm(t.lstrip("- ").strip()) in def_full or norm(t) in def_full:
                            STATS["删具体理解重复"] += 1
                        else:
                            kept.append(lines[j])
                        j += 1
                    else:
                        break
                if kept:
                    out.append(l)
                    out.extend(kept)
                else:
                    STATS["删空具体理解标签"] += 1
                changed_speed = True
                i = j
                continue
            m1 = re.match(r"^- \*\*一句话\*\*：(.+)$", s)
            if m1:
                content = m1.group(1)
                new_c = content
                m2 = re.match(r"^(.*。)[^。]*?作用[：:](.+?)。$", content)
                if m2 and norm(m2.group(2)) in def_effs:
                    new_c = m2.group(1)
                    STATS["一句话去重作用句"] += 1
                m3 = re.match(r"^([^：]{1,24})：\1是", new_c)
                if m3:
                    new_c = new_c[len(m3.group(1)) + 1 :]
                    STATS["去概念名重复"] += 1
                # 修复此前误删主语的无主句：与定义条目 body 匹配则回填概念名
                if new_c.startswith("是"):
                    nb = norm(new_c)
                    if nb in def_bodies:
                        new_c = f"{def_bodies[nb]}{new_c}"
                        STATS["回填一句话主语"] += 1
                if new_c != content:
                    changed_speed = True
                    out.append(f"- **一句话**：{new_c}")
                else:
                    out.append(l)
                i += 1
                continue
            out.append(l)
            i += 1
        out.extend(lines[s1:])
        new_text = "\n".join(out).rstrip("\n") + "\n"
        if new_text != old_text:
            p.write_text(new_text, encoding="utf-8")
            changed += 1
    print({"changed": changed}, dict(STATS.most_common()))


if __name__ == "__main__":
    main()