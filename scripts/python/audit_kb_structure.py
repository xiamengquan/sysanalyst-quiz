#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""知识点结构审计：扫描 content/kb/points/*.md，量化结构乱象。

输出问题分类统计 + 每篇问题清单（写入 docs/kb-workshop/审计委员会/意见/ 结构审计）。
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POINTS = ROOT / "content/kb/points"

PLACEHOLDER_PATTERNS = [
    r"本节在教程中未单独列出固定步骤名",
    r"与同章相邻考点区分",
    r"检索关键词：\*\*",
    r"本节与相邻考点易混点见归档篇章",
    r"用于主要用于",
]

SECTION_ALIASES = {
    "易混对比": "易混辨析",
    "核心知识点/概念": "核心概念",
    "本章考什么": "概述",
}

def audit_file(p: Path) -> dict:
    text = p.read_text(encoding="utf-8")
    lines = text.splitlines()
    problems: list[str] = []

    h1 = [l for l in lines if re.match(r"^# [^#]", l)]
    if len(h1) > 1:
        problems.append(f"H1×{len(h1)}: " + " | ".join(x.strip()[:30] for x in h1[1:]))

    # H2 章节统计与重复
    h2s = [l.lstrip("# ").strip() for l in lines if re.match(r"^## ", l)]
    dup_h2 = [k for k, v in Counter(h2s).items() if v > 1]
    if dup_h2:
        problems.append(f"重复H2: {dup_h2}")

    # 节名变体
    variants = []
    for h in h2s:
        base = h.split("（")[0].split("（")[0].strip()
        if base in SECTION_ALIASES:
            variants.append(f"{h}→应[{SECTION_ALIASES[base]}]")
    if variants:
        problems.append("节名变体: " + "; ".join(variants))

    # 占位文案
    ph_hits = []
    for pat in PLACEHOLDER_PATTERNS:
        n = len(re.findall(pat, text))
        if n:
            ph_hits.append(f"{pat[:18]}…×{n}")
    if ph_hits:
        problems.append("占位文案: " + ", ".join(ph_hits))

    # 残缺表格：| 行后跟非 | 非空行
    broken = 0
    for i, l in enumerate(lines):
        if l.strip().startswith("|") and i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if nxt and not nxt.startswith("|") and not nxt.startswith("#"):
                # 表头下一行不是分隔行且不是表格延续
                if not re.match(r"^\|[\s:-]+\|", nxt) and not nxt.startswith("|"):
                    broken += 1
    if broken:
        problems.append(f"疑似残缺表格×{broken}")

    # 完全重复的行（≥20字符，非表格分隔/空行/标题）
    seen: dict[str, int] = {}
    for l in lines:
        s = l.strip()
        if len(s) >= 20 and not s.startswith("|-") and not s.startswith("#") and not s.startswith(">"):
            seen[s] = seen.get(s, 0) + 1
    dup_lines = {k: v for k, v in seen.items() if v >= 2}
    if dup_lines:
        problems.append(f"重复行×{sum(v for v in dup_lines.values()) - len(dup_lines)}")

    # 旧版残留痕迹：要点节里出现「出自《系统分析师教程》」整章头
    if re.search(r"出自《系统分析师教程》", text):
        problems.append("残留整章头(出自《系统分析师教程》)")
    # 旧编号小节 ### 一、/### 二、
    old_num = re.findall(r"^### [一二三四五六七八九十]+、", text, re.M)
    if old_num:
        problems.append(f"旧编号小节×{len(old_num)}")

    # 「用于主要用于」病句 & 速懂复制定义
    n_zy = len(re.findall(r"用于主要用于", text))
    if n_zy:
        problems.append(f"病句「用于主要用于」×{n_zy}")

    def sec_span(name: str) -> tuple[int, int]:
        st = next((k for k, l in enumerate(lines) if l.strip() == f"## {name}"), -1)
        if st < 0:
            return -1, -1
        en = next((k for k in range(st + 1, len(lines)) if lines[k].startswith("## ")), len(lines))
        return st, en

    d0, d1 = sec_span("定义")
    s0, s1 = sec_span("速懂")
    if d0 >= 0 and s0 >= 0:
        defset = set()
        for l in lines[d0 + 1 : d1]:
            t = l.strip().replace("*", "").replace(" ", "")
            if t.startswith("-"):
                defset.add(t[1:] if t[1] != "*" else t.lstrip("-"))
        dup_n = 0
        for l in lines[s0 + 1 : s1]:
            t = l.strip().replace("*", "").replace(" ", "")
            if t.startswith("-") and len(t) >= 20:
                body = t[1:] if t[1] != "*" else t.lstrip("-")
                # 一句话是速懂锚点（设计上允许与首个定义呼应），不计重复
                if body.startswith("一句话"):
                    continue
                if body in defset:
                    dup_n += 1
        if dup_n:
            problems.append(f"速懂复制定义×{dup_n}")

    return {
        "file": p.name,
        "lines": len(lines),
        "h2": len(h2s),
        "problems": problems,
    }

def main() -> None:
    files = sorted(POINTS.glob("kp-*.md"))
    results = [audit_file(p) for p in files]
    clean = [r for r in results if not r["problems"]]
    dirty = [r for r in results if r["problems"]]

    cat: Counter = Counter()
    for r in dirty:
        for prob in r["problems"]:
            cat[prob.split(":")[0].split("×")[0].split("(")[0].strip()] += 1

    print({"total": len(results), "clean": len(clean), "dirty": len(dirty)})
    print("问题分类:")
    for k, v in cat.most_common():
        print(f"  {k}: {v} 篇")

    out_dir = ROOT / "docs/kb-workshop/审计委员会/意见"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"结构审计-points-{date.today().isoformat()}.json"
    payload = {
        "date": date.today().isoformat(),
        "summary": {"total": len(results), "clean": len(clean), "dirty": len(dirty)},
        "categories": dict(cat.most_common()),
        "files": results,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("报告 →", out.relative_to(ROOT))

    # 打印最严重的 15 篇
    worst = sorted(dirty, key=lambda r: -len(r["problems"]))[:15]
    print("\n最严重 15 篇:")
    for r in worst:
        print(f"  {r['file']}: {len(r['problems'])} 项 -> {[x[:40] for x in r['problems'][:4]]}")

if __name__ == "__main__":
    main()