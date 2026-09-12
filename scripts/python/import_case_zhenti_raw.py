#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convert raw 51CTO-style case JSON dumps → content/banks/real/案例分析/all.jsonl

Usage:
  Place files as content/banks/real/案例分析/raw/YYYY半.json
  Each file is a JSON array of question objects (as exported by user).
  Then: python3 scripts/python/import_case_zhenti_raw.py
"""
from __future__ import annotations
import html, json, re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "content/banks/real/案例分析/raw"
OUT_DIR = ROOT / "content/banks/real/案例分析"
OUT_JSONL = OUT_DIR / "all.jsonl"

# year-half inferred from filename: 2026上.json / 2023下.json
DOMAIN_HINT = {
    "需求": (11, "需求"),
    "用例": (11, "需求"),
    "DFD": (11, "需求"),
    "FAST": (10, "需求"),
    "UML": (12, "架构"),
    "面向对象": (12, "架构"),
    "MVC": (16, "Web"),
    "Web": (16, "Web"),
    "SSM": (16, "Web"),
    "Redis": (16, "Web"),
    "缓存": (16, "Web"),
    "微服务": (20, "微服务"),
    "嵌入式": (17, "嵌入式"),
    "机器人": (17, "嵌入式"),
    "容器": (17, "嵌入式"),
    "区块链": (16, "Web"),
    "大数据": (19, "大数据"),
    "NoSQL": (5, "数据库"),
    "数据库": (5, "数据库"),
    "分片": (5, "数据库"),
    "PERT": (8, "项目管理"),
    "MDA": (12, "架构"),
}


def strip_html(s: str) -> str:
    if not s:
        return ""
    s = html.unescape(s)
    # keep images as markdown
    def repl_img(m):
        url = m.group(1)
        return f"\n![]({url})\n"

    s = re.sub(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*/?>', repl_img, s, flags=re.I)
    s = s.replace("<br/>", "\n").replace("<br>", "\n").replace("</p>", "\n").replace("<p>", "")
    s = re.sub(r"</?li[^>]*>", "\n- ", s, flags=re.I)
    s = re.sub(r"</?ul[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def infer_meta(stem: str, title: str):
    blob = stem + title
    chapter, domain = 16, "Web"
    for k, (ch, d) in DOMAIN_HINT.items():
        if k in blob:
            chapter, domain = ch, d
            break
    track = "P2" if domain in {"嵌入式", "CPS"} else ("P1" if domain in {"大数据", "项目管理"} else "P0")
    case_type = "方案对比"
    if any(x in blob for x in ("填", "完善", "补充", "空（", "(1)")):
        case_type = "架构设计"
    if any(x in blob for x in ("改进", "问题", "错误", "优化")):
        case_type = "分析改进"
    return chapter, domain, track, case_type


def parse_year_half(name: str):
    """Accept 2026上 / 2025下 / 202605 / 202511."""
    m = re.match(r"(\d{4})([上下])$", name)
    if m:
        return m.group(1), m.group(2)
    m = re.match(r"(\d{4})(0[1-9]|1[0-2])$", name)
    if m:
        year, mm = m.group(1), int(m.group(2))
        half = "上" if mm <= 6 else "下"
        return year, half
    return "未知", ""


def convert_file(fp: Path, start_no: int) -> tuple[list[dict], list[dict]]:
    year, half = parse_year_half(fp.stem)
    if year == "未知":
        print("skip unknown year file:", fp.name)
        return [], []
    rows = json.loads(fp.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        print("skip non-array:", fp.name)
        return [], []

    # First group by new_parent_id
    groups: dict[str, list] = defaultdict(list)
    order = []
    for r in rows:
        pid = str(r.get("new_parent_id") or r.get("question_id"))
        if pid not in groups:
            order.append(pid)
        groups[pid].append(r)

    # If many singleton parents share the same 【说明】, merge into one exam case
    def explain_key(items: list) -> str:
        text = strip_html(items[0].get("material_text") or items[0].get("question_title") or "")
        m = re.search(r"【说明】([\s\S]{80,800}?)(?=【问题|问题内容|$)", text)
        if m:
            return re.sub(r"\s+", "", m.group(1))[:400]
        # fallback: first 200 chars after 试题/说明
        return re.sub(r"\s+", "", text)[:300]

    merged_order: list[str] = []
    merged_groups: dict[str, list] = {}
    key_to_gid: dict[str, str] = {}
    singleton_keys = {pid: explain_key(groups[pid]) for pid in order if len(groups[pid]) == 1}

    # Only merge when we have many singletons with duplicate keys (e.g. 2018 dump)
    from collections import Counter as _Counter

    key_counts = _Counter(singleton_keys.values())
    do_merge = any(v >= 2 for v in key_counts.values()) and sum(1 for v in key_counts.values() if v >= 2) >= 1

    for pid in order:
        items = groups[pid]
        if do_merge and len(items) == 1:
            k = singleton_keys[pid]
            if key_counts[k] >= 2 and k:
                if k not in key_to_gid:
                    gid = f"merge:{k[:40]}"
                    key_to_gid[k] = gid
                    merged_order.append(gid)
                    merged_groups[gid] = []
                merged_groups[key_to_gid[k]].extend(items)
                continue
        merged_order.append(pid)
        merged_groups[pid] = items

    order = merged_order
    groups = merged_groups

    cases = []
    no = start_no
    exam_no = 0
    for pid in order:
        items = sorted(groups[pid], key=lambda x: int(x.get("sort_son") or x.get("index") or 0))
        # skip empty / 暂缺 only
        titles = [strip_html(i.get("question_title") or "") for i in items]
        if all(t in {"", "暂缺"} for t in titles) and all(
            "暂缺" in strip_html(i.get("material_text") or "") for i in items
        ):
            continue
        if all("暂缺" in t for t in titles if t):
            continue

        # stem: prefer material_text; if empty, use first question_title that embeds 说明
        stem = strip_html(items[0].get("material_text") or "")
        if not stem:
            # some dumps put full text in question_title of index0
            stem = strip_html(items[0].get("question_title") or "")
            # if combined Q1-Q3 in one card, keep as stem and still split questions if multiple
        exam_no += 1
        no += 1
        chapter, domain, track, case_type = infer_meta(stem, titles[0])

        questions = []

        def split_problems(blob: str, sample: str, score: int = 0):
            parts = re.split(r"(?=【问题\s*\d)", blob)
            if len(parts) <= 1:
                return None, []
            stem_part = parts[0].strip()
            qs = []
            for j, part in enumerate(parts[1:], 1):
                qs.append(
                    {
                        "qnum": j,
                        "prompt": part.strip(),
                        "answer_type": "short",
                        "word_limit": 200 if "200字" in part else (300 if "300字" in part else 0),
                        "score": score,
                        "rubric": {"must_hit": [], "sample": ""},
                        "hint": "真题参考答案（非唯一；答题回扣题干）",
                    }
                )
            ans_parts = re.split(r"(?=【问题\s*\d)", sample) if sample else []
            if len(ans_parts) > 1:
                for j, ap in enumerate(ans_parts[1:], 1):
                    if j <= len(qs):
                        qs[j - 1]["rubric"]["sample"] = ap.strip() or "（参考答案待补）"
            elif sample:
                for q in qs:
                    q["rubric"]["sample"] = sample
            for q in qs:
                if not q["rubric"]["sample"]:
                    q["rubric"]["sample"] = "（参考答案待补）"
            return stem_part, qs

        # One card containing 说明+问题1~3
        if len(items) == 1:
            it = items[0]
            ans = strip_html("\n".join(it.get("answer") or []))
            stem2, qs = split_problems(stem, ans, it.get("score") or 0)
            if qs:
                if stem2:
                    stem = stem2
                questions = qs

        if not questions:
            # Prefer stem = shared 【说明】 from first item; prompts = 【问题N】 only
            explain_m = re.search(r"【说明】[\s\S]*?(?=【问题|$)", stem)
            if explain_m and len(items) > 1:
                stem = explain_m.group(0).strip()

            for i, it in enumerate(items, 1):
                prompt = strip_html(it.get("question_title") or "")
                ans_list = it.get("answer") or []
                sample = strip_html("\n".join(ans_list) if isinstance(ans_list, list) else str(ans_list))
                if prompt in {"", "暂缺"}:
                    continue
                # Trim repeated 说明; keep from 【问题
                qm = re.search(r"【问题\s*\d[\s\S]*", prompt)
                if qm:
                    prompt = qm.group(0).strip()
                # If this card still has multiple 问题, take only the primary one matching index
                # sample may include all problems — keep matching section if present
                sm = re.search(rf"【问题\s*{i}[\s\S]*?(?=【问题\s*\d|$)", sample)
                if sm:
                    sample = sm.group(0).strip()
                questions.append(
                    {
                        "qnum": i,
                        "prompt": prompt,
                        "answer_type": "short",
                        "word_limit": 200 if "200字" in prompt else (300 if "300字" in prompt else 0),
                        "score": it.get("score") or 0,
                        "rubric": {"must_hit": [], "sample": sample or "（参考答案待补）"},
                        "hint": "真题参考答案（非唯一；答题回扣题干）",
                    }
                )

        if not questions:
            continue

        # Deduplicate question prompts that are identical after trim
        seen_p = set()
        uniq_q = []
        for q in questions:
            key = re.sub(r"\s+", "", q["prompt"])[:120]
            if key in seen_p:
                continue
            seen_p.add(key)
            q["qnum"] = len(uniq_q) + 1
            uniq_q.append(q)
        questions = uniq_q

        # title from stem first line
        title_m = re.search(r"试题[一二三四五六七八九十\d]+[^\n]{0,40}", stem)
        short = title_m.group(0) if title_m else f"试题{exam_no}"
        cases.append(
            {
                "no": no,
                "id": f"ZT-{year}{half}-案例{exam_no:02d}",
                "subject": "case",
                "bank": "real",
                "year": year,
                "half": half,
                "exam_no": exam_no,
                "chapter": chapter,
                "domain": domain,
                "case_type": case_type,
                "point": f"{year}{half}·{short}",
                "track": track,
                "stop_loss": track == "P2",
                "depth": "real",
                "stem": stem,
                "questions": questions,
                "source": f"{year}年{'上' if half == '上' else '下'}半年系统分析师·案例分析真题",
                "time_limit_min": 25,
                "raw_file": fp.name,
            }
        )
    packs = []
    if cases:
        packs.append(
            {
                "id": f"pack-{year}{'s' if half == '上' else 'x'}",
                "title": f"真题 · {year}{half} 案例分析（{len(cases)}题）",
                "rule": "试题一必答；其余选答两题（按当年规则演练）",
                "select_hint": "真题回忆/整理版，配图可能为外链",
                "cases": [c["id"] for c in cases],
                "bank": "real",
                "year": year,
                "half": half,
            }
        )
    return cases, packs


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(RAW_DIR.glob("*.json"))
    if not files:
        print("No raw/*.json found. Drop year files like 2026上.json into", RAW_DIR)
        return
    all_cases = []
    all_packs = []
    no = 2000
    for fp in files:
        cases, packs = convert_file(fp, no)
        if cases:
            no = cases[-1]["no"]
        all_cases.extend(cases)
        all_packs.extend(packs)
        print(fp.name, "→", len(cases), "cases")

    OUT_JSONL.write_text(
        "\n".join(json.dumps(c, ensure_ascii=False) for c in all_cases) + "\n",
        encoding="utf-8",
    )
    for p in all_packs:
        (OUT_DIR / f"{p['year']}{p['half']}-pack.json").write_text(
            json.dumps(p, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    (OUT_DIR / "README.md").write_text(
        "# 案例分析真题库\n\n"
        f"- 共 **{len(all_cases)}** 套（由 `raw/*.json` 自动转换）\n"
        "- 原始导出放 `raw/YYYY半.json` 后运行 `import_case_zhenti_raw.py`\n"
        "- 站点：案例分析 → 题库选「真题」或打开对应模拟包\n",
        encoding="utf-8",
    )
    from collections import Counter

    print({"total": len(all_cases), "years": dict(Counter(f"{c['year']}{c['half']}" for c in all_cases))})


if __name__ == "__main__":
    main()
