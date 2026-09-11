#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deduplicate MCQ bank: keep one basic per knowledge point + all deep questions."""
from __future__ import annotations
import json, hashlib, re
from pathlib import Path
from collections import defaultdict

ROOT = Path("/Users/workflow/Documents/系统分析师知识点精炼/题库")
MCQ_DIR = ROOT / "综合知识"
WEB_DIR = ROOT / "答题网页"

CH_NAMES = {
    0: "综合与法规杂项", 1: "绪论", 2: "数学与工程基础", 3: "计算机系统",
    4: "计算机网络与分布式系统", 5: "数据库系统", 6: "企业信息化", 7: "软件工程",
    8: "项目管理", 9: "信息安全", 10: "系统规划与分析", 11: "软件需求工程",
    12: "软件架构设计", 13: "系统设计", 14: "软件实现与测试", 15: "系统运行与维护",
    16: "Web应用", 17: "嵌入式系统", 18: "移动应用", 19: "大数据",
    20: "微服务", 21: "信息物理系统CPS", 22: "论文与文档",
}

def qid(*parts):
    return hashlib.md5("||".join(map(str, parts)).encode()).hexdigest()[:10]

def clean_stem(stem: str) -> str:
    s = stem
    s = re.sub(r"^（[^）]+）", "", s)
    s = re.sub(r"^第\d+题：", "", s)
    s = re.sub(r"^【练习】", "", s)
    return s.strip()

def stem_score(stem: str) -> int:
    """Prefer clean, short, non-prefixed stems."""
    score = 100
    if stem.startswith("（") or stem.startswith("【"):
        score -= 40
    if "第" in stem[:6] and "题" in stem[:10]:
        score -= 30
    # prefer classic definition stem
    if stem.startswith("关于") and "说法正确" in stem:
        score += 10
    score -= min(len(stem) // 20, 15)
    return score

def load():
    qs = []
    for line in (MCQ_DIR / "all.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            qs.append(json.loads(line))
    return qs

def dedupe(qs):
    basic_groups = defaultdict(list)
    deep = []
    for q in qs:
        diff = q.get("difficulty", "basic")
        if diff == "deep":
            deep.append(q)
            continue
        correct = q["options"][q["answer"]]
        key = (q["chapter"], q.get("point", ""), correct)
        basic_groups[key].append(q)

    basic_kept = []
    for key, items in basic_groups.items():
        # pick best stem
        best = max(items, key=lambda x: stem_score(x["stem"]))
        best = dict(best)
        best["stem"] = clean_stem(best["stem"])
        best["difficulty"] = "basic"
        basic_kept.append(best)

    # dedupe deep by stem
    seen = set()
    deep_kept = []
    for q in deep:
        st = q["stem"].strip()
        if st in seen:
            continue
        seen.add(st)
        # also skip if identical correct+point already as deep duplicate
        deep_kept.append(q)

    # Remove deep that are near-clones of basic (same point + same correct text)
    basic_keys = {(q["chapter"], q.get("point",""), q["options"][q["answer"]]) for q in basic_kept}
    deep_final = []
    for q in deep_kept:
        k = (q["chapter"], q.get("point",""), q["options"][q["answer"]])
        # keep deep even if same point — they have different stems/scenarios
        # only drop if stem normalizes to same as a basic stem
        deep_final.append(q)

    all_q = basic_kept + deep_final
    all_q.sort(key=lambda x: (x["chapter"], 0 if x.get("difficulty") == "basic" else 1, x["stem"]))
    for i, q in enumerate(all_q, 1):
        q["no"] = i
        q["id"] = f"CK-{q['chapter']:02d}-{qid(q['stem'], q['answer'], i)}"
    return all_q, len(basic_kept), len(deep_final)

def write_all(all_q):
    with (MCQ_DIR / "all.jsonl").open("w", encoding="utf-8") as f:
        for q in all_q:
            f.write(json.dumps(q, ensure_ascii=False) + "\n")

    by_ch = defaultdict(list)
    for q in all_q:
        by_ch[q["chapter"]].append(q)

    n_deep = sum(1 for q in all_q if q.get("difficulty") == "deep")
    n_basic = len(all_q) - n_deep
    index_lines = [
        "# 综合知识练习题库",
        "",
        f"> 已去重。基础题 **{n_basic}** + 深度题 **{n_deep}** = **{len(all_q)}**。",
        "> 早期模板扩写产生的重复题已删除；每考点保留 1 道基础题，另含情景/计算类深度题。",
        "",
        "| 章 | 主题 | 题量 | 文件 |",
        "|----|------|------|------|",
    ]
    ans_lines = ["# 综合知识 · 答案汇总", "", "| 题号 | 章 | 难度 | 答案 | 考点 |", "|------|----|------|------|------|"]

    for ch in sorted(by_ch):
        qs = by_ch[ch]
        name = CH_NAMES.get(ch, f"第{ch}章")
        fname = f"第{ch:02d}章-{name}.md"
        lines = [f"# 综合知识 · 第{ch}章 {name}", "", f"共 {len(qs)} 题（已去重）。", "", "---", ""]
        for q in qs:
            tag = "深度" if q.get("difficulty") == "deep" else "基础"
            lines.append(f"### {q['no']}. [{tag}] {q['stem']}")
            lines.append("")
            for k in "ABCD":
                lines.append(f"- {k}. {q['options'][k]}")
            lines.append("")
            lines.append(f"<!-- ANS {q['answer']} | {q['point']} | {q.get('difficulty','basic')} -->")
            lines.append("")
            ans_lines.append(f"| {q['no']} | {ch} | {tag} | **{q['answer']}** | {q['point']} |")
        lines.append("---\n\n## 本章答案速查\n")
        lines.append(" ".join(f"{q['no']}-{q['answer']}" for q in qs) + "\n")
        (MCQ_DIR / fname).write_text("\n".join(lines), encoding="utf-8")
        index_lines.append(f"| {ch} | {name} | {len(qs)} | [{fname}](./{fname}) |")

    (MCQ_DIR / "00-目录.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    (MCQ_DIR / "综合知识-答案汇总.md").write_text("\n".join(ans_lines) + "\n", encoding="utf-8")

    web = [{
        "no": q["no"], "ch": q["chapter"], "point": q["point"], "stem": q["stem"],
        "opts": q["options"], "ans": q["answer"], "exp": q.get("explain", ""),
        "diff": q.get("difficulty", "basic"),
    } for q in all_q]
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    (WEB_DIR / "questions.js").write_text(
        "window.QUESTIONS = " + json.dumps(web, ensure_ascii=False) + ";\n", encoding="utf-8"
    )

    readme = ROOT / "00-题库说明.md"
    if readme.exists():
        text = readme.read_text(encoding="utf-8")
        # light touch: rewrite summary section if present
    (ROOT / "00-题库说明.md").write_text(f"""# 系统分析师练习题库

## 内容

| 类型 | 数量 | 目录 |
|------|------|------|
| 综合知识（单选，已去重） | {len(all_q)}（基础 {n_basic} + 深度 {n_deep}） | [综合知识/00-目录.md](./综合知识/00-目录.md) |
| 案例分析 | 100 | [案例分析/00-目录.md](./案例分析/00-目录.md) |
| 本地答题页 | — | [答题网页/](./答题网页/) |

## 说明

- 早期版本用同一考点换题干前缀扩到约 2000 题，**重复严重，已清理**。
- 现为：每考点 1 道基础题 + 情景/计算/对比类深度题。
- 本地刷题：在 `答题网页` 目录执行 `./启动.sh`，打开 http://127.0.0.1:8765/

## 答案

- 综合知识：各章文末 + [综合知识-答案汇总.md](./综合知识/综合知识-答案汇总.md)
- 案例：每题文内参考要点
""", encoding="utf-8")

def main():
    qs = load()
    print("before", len(qs))
    all_q, nb, nd = dedupe(qs)
    write_all(all_q)
    print("after", len(all_q), "basic", nb, "deep", nd)
    # verify uniqueness
    keys = set()
    dups = 0
    for q in all_q:
        if q.get("difficulty") != "basic":
            continue
        k = (q["chapter"], q["point"], q["options"][q["answer"]])
        if k in keys:
            dups += 1
        keys.add(k)
    print("basic key dups", dups, "unique stems", len(set(q["stem"] for q in all_q)))

if __name__ == "__main__":
    main()
