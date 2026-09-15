#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convert raw 51CTO-style morning MCQ JSON dumps → content/banks/real/综合知识/all.jsonl

Also refreshes content/banks/real/上午真题.jsonl for backward-compatible tooling paths.

Usage:
  Place files as content/banks/real/综合知识/raw/YYYYMM.json
  (YYYY05 = 上半年, YYYY11 = 下半年; also accepts YYYY上 / YYYY下)
  Then: python3 scripts/python/import_mcq_zhenti_raw.py
"""
from __future__ import annotations

import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "content/banks/real/综合知识/raw"
OUT_DIR = ROOT / "content/banks/real/综合知识"
OUT_JSONL = OUT_DIR / "all.jsonl"
LEGACY_JSONL = ROOT / "content/banks/real/上午真题.jsonl"
README = OUT_DIR / "README.md"


def strip_html(s: str) -> str:
    if not s:
        return ""
    s = html.unescape(s)
    s = s.replace("\xa0", " ").replace("&nbsp;", " ")

    def repl_img(m: re.Match) -> str:
        url = m.group(1)
        return f"\n![]({url})\n"

    s = re.sub(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*/?>', repl_img, s, flags=re.I)
    s = s.replace("<br/>", "\n").replace("<br>", "\n").replace("</p>", "\n").replace("<p>", "")
    s = re.sub(r"</?li[^>]*>", "\n- ", s, flags=re.I)
    s = re.sub(r"</?ul[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip()


WATERMARK_RE = re.compile(
    r"^【[^】]*51CTO[^】]*】\s*"
    r"|^【\s*学员回忆版\s*】\s*"
    r"|^【\s*回忆版\s*】\s*",
    re.I,
)


def clean_stem(s: str) -> str:
    s = strip_html(s)
    for _ in range(5):
        s2 = WATERMARK_RE.sub("", s).strip()
        s2 = re.sub(r"(【空（\d+）】)\s*【[^】]*51CTO[^】]*】\s*", r"\1", s2, flags=re.I)
        s2 = re.sub(r"(【空（\d+）】)\s*【\s*学员回忆版\s*】\s*", r"\1", s2)
        s2 = re.sub(r"【[^】]*51CTO[^】]*】\s*", "", s2, flags=re.I)
        # 缺左括号的残缺水印
        s2 = re.sub(r"^51CTO[^】\n]{0,40}】\s*", "", s2, flags=re.I)
        if s2 == s:
            break
        s = s2
    return s.strip()


def parse_year_half(name: str) -> tuple[str, str]:
    """Accept 2026上 / 2025下 / 202605 / 202511."""
    m = re.match(r"^(\d{4})([上下])$", name)
    if m:
        return m.group(1), m.group(2)
    m = re.match(r"^(\d{4})(0[1-9]|1[0-2])$", name)
    if m:
        year, mm = m.group(1), int(m.group(2))
        half = "上" if mm <= 6 else "下"
        return year, half
    return "未知", ""


def letters_opts(options: list) -> dict[str, str]:
    labels = "ABCDEFGH"
    out: dict[str, str] = {}
    for i, opt in enumerate(options or []):
        if i >= len(labels):
            break
        out[labels[i]] = strip_html(str(opt))
    return out


def pick_answer(ans) -> str:
    if isinstance(ans, list):
        ans = ans[0] if ans else ""
    s = str(ans or "").strip().upper()
    m = re.search(r"[A-H]", s)
    return m.group(0) if m else s[:1]


def source_label(year: str, half: str) -> str:
    if half:
        return f"{year}年{half}半年上午-综合知识"
    return f"{year}年上午-综合知识"


def convert_file(fp: Path) -> list[dict]:
    year, half = parse_year_half(fp.stem)
    if year == "未知":
        print("skip unknown year file:", fp.name)
        return []
    rows = json.loads(fp.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        print("skip non-array:", fp.name)
        return []

    items: list[dict] = []
    for r in sorted(rows, key=lambda x: int(x.get("index") or 0)):
        qnum = int(r.get("index") or 0)
        if qnum <= 0:
            continue
        stem = clean_stem(r.get("question_title") or "")
        material = clean_stem(r.get("material_text") or "")
        if material and material not in stem:
            stem = f"{material}\n\n{stem}".strip()

        sort_son = str(r.get("sort_son") or "0").strip()
        if sort_son.isdigit() and int(sort_son) > 0:
            # 完形多空：同一段题干拆成多道，标明空位
            marker = f"（{int(sort_son)}）"
            if f"【空{marker}】" not in stem:
                stem = f"【空{marker}】{stem}"
            stem = clean_stem(stem)

        opts = letters_opts(r.get("option") or [])
        if len(opts) < 2:
            print(f"  warn {fp.name}#{qnum}: options < 2, skip")
            continue
        ans = pick_answer(r.get("answer"))
        if ans not in opts:
            print(f"  warn {fp.name}#{qnum}: ans {ans!r} not in opts {list(opts)}, keep anyway")

        exp = strip_html(r.get("analyze") or "")
        src = source_label(year, half)
        qid = f"ZT-{year}{half}-{qnum:03d}"
        # stable short hash from raw id if present
        raw_id = r.get("question_id")
        if raw_id:
            h = hashlib.md5(str(raw_id).encode()).hexdigest()[:8]
            qid = f"ZT-{year}{half}-{qnum:03d}-{h}"

        items.append(
            {
                "id": qid,
                "source": src,
                "year": year,
                "half": half,
                "kind": "上午",
                "qnum": qnum,
                "stem": stem,
                "opts": opts,
                "ans": ans,
                "exp": exp,
                "diff": "real",
                "paper": fp.name,
                "no": qnum,
                "show_type": r.get("show_type_name") or "单选题",
                "blank": int(sort_son) if sort_son.isdigit() and int(sort_son) > 0 else 0,
                "bank": "real",
                "edition": "data-v1",
            }
        )
    return items


def write_readme(rows: list[dict], by_file: list[tuple[str, int, str, str]]) -> None:
    years = sorted({(r["year"], r["half"]) for r in rows})
    lines = [
        "# 综合知识真题库（上午选择题）",
        "",
        f"- 共 **{len(rows)}** 道（由 `raw/*.json` 自动转换）",
        "- 原始导出放 `raw/YYYYMM.json`（如 `202605.json`）后运行：",
        "",
        "```bash",
        "python3 scripts/python/import_mcq_zhenti_raw.py",
        "npm run sync:data",
        "```",
        "",
        "## 覆盖场次",
        "",
        "| 文件 | 年份 | 半年 | 题量 |",
        "|------|------|------|------|",
    ]
    for name, n, y, h in by_file:
        lines.append(f"| `{name}` | {y} | {h or '—'} | {n} |")
    lines.extend(
        [
            "",
            f"场次合计：**{len(years)}**（{', '.join(f'{y}{h}' for y, h in years)}）",
            "",
            "> 个人学习用途。部分年份题量不足 75，以导出文件为准。完形多空按空拆题，题干前标【空（n）】。",
            "",
        ]
    )
    README.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(RAW_DIR.glob("*.json"))
    if not files:
        print("No raw/*.json found. Drop year files like 202605.json into", RAW_DIR)
        return

    all_rows: list[dict] = []
    by_file: list[tuple[str, int, str, str]] = []
    for fp in files:
        rows = convert_file(fp)
        y, h = parse_year_half(fp.stem)
        by_file.append((fp.name, len(rows), y, h))
        all_rows.extend(rows)
        print(f"{fp.name} → {len(rows)} questions ({y}{h})")

    # stable global no for legacy tooling
    for i, r in enumerate(all_rows, 1):
        r["no"] = i

    text = "\n".join(json.dumps(r, ensure_ascii=False) for r in all_rows) + "\n"
    OUT_JSONL.write_text(text, encoding="utf-8")
    LEGACY_JSONL.write_text(text, encoding="utf-8")
    write_readme(all_rows, by_file)
    print(f"wrote {OUT_JSONL.relative_to(ROOT)} ({len(all_rows)})")
    print(f"wrote {LEGACY_JSONL.relative_to(ROOT)} (compat)")


if __name__ == "__main__":
    main()
