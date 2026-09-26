#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""自《大纲考点对照》生成 API 式单考点 Markdown + 合并 kb-index。"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTLINE = ROOT / "content/kb/速查/大纲考点对照.md"
POINTS_DIR = ROOT / "content/kb/points"
INDEX = ROOT / "content/kb-index.json"
SECTION_ID = "api-ref"
SECTION_TITLE = "考点参考（API · 一考点一篇）"

# 已有人工/ref 正文迁移（path 相对 content/kb）
CONTENT_OVERRIDES: dict[str, str] = {}

SUBJ_SHORT = {
    "科目1：系统分析师综合知识": "科目1",
    "科目2：系统分析师案例分析": "科目2",
    "科目3：系统分析师论文": "科目3",
}


def slugify(title: str, outline_ref: str, used: set[str]) -> str:
    m = re.match(r"^(\d+(?:\.\d+)*)\s*(.+)", title.strip())
    if m:
        oid = m.group(1).replace(".", "-")
        base = f"kp-{oid}"
    else:
        t = re.sub(r"[^\w\u4e00-\u9fff]+", "-", title.strip()).strip("-")[:32]
        base = f"kp-{t}" if t else "kp-x"
    cand = base
    n = 2
    while cand in used:
        cand = f"{base}-{n}"
        n += 1
    used.add(cand)
    return cand


def parse_chapter(ref: str) -> int | None:
    m = re.search(r"第(\d+)章", ref)
    if m:
        return int(m.group(1))
    m = re.search(r"^(\d+)\.", ref.strip())
    if m:
        return int(m.group(1))
    return None


def parse_outline_rows() -> list[dict]:
    text = OUTLINE.read_text(encoding="utf-8")
    rows: list[dict] = []
    subject = ""
    group = ""
    for line in text.splitlines():
        if line.startswith("## "):
            subject = line[3:].strip()
            group = ""
            continue
        if line.startswith("### "):
            group = line[4:].strip()
            continue
        if not line.startswith("|") or "---" in line:
            continue
        parts = [p.strip() for p in line.split("|")[1:-1]]
        if len(parts) < 2:
            continue
        title, ref = parts[0], parts[1]
        if title in ("大纲条目", "项目", "能力目标") or not title:
            continue
        if subject.startswith("考试说明"):
            continue
        if not group:
            continue
        if ref in ("—", "-", "内容") and not re.match(r"^\d", title):
            continue
        rows.append(
            {
                "subject": subject,
                "group": f"{SUBJ_SHORT.get(subject, subject)} · {group.split('→')[0].strip()}",
                "title": title,
                "ref": ref,
            }
        )
    return rows


def render_point_body(row: dict, point_id: str) -> str:
    title = row["title"]
    ref = row["ref"]
    group = row["group"]
    ch = parse_chapter(ref)
    ch_line = f"第{ch}章" if ch else "—"
    override = CONTENT_OVERRIDES.get(point_id, "").strip()
    if override:
        body = override
    else:
        body = f"""## 概述

（待编制：{title} 在软考中的位置与常见问法。）

## 定义

（待编制：采用「**{title.split()[0] if title else '本概念'}** 是……；**用于**……」答卷句。）

## 要点

（待编制）

## 易混辨析

（待编制）

## 应试

（待编制：选择题信号词 / 案例回扣 / 论文论点。）

## 相关考点

- （待补充链至其它 `kp-*` 条目）
"""
    return f"""# {title}

> **大纲**：{ref} · **教程**：{ch_line} · **分组**：{group}

{body}
"""


def merge_index(items: list[dict]) -> None:
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    sections = [s for s in data.get("sections", []) if s.get("id") != SECTION_ID]
    api_section = {
        "id": SECTION_ID,
        "title": SECTION_TITLE,
        "items": items,
    }
    data["sections"] = [api_section] + sections
    meta = data.setdefault("meta", {})
    meta["apiPoints"] = len(items)
    meta["apiModel"] = "docs/kb-workshop/程序/知识点API参考模型.md"
    INDEX.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--merge-index", action="store_true", help="写入 kb-index.json")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rows = parse_outline_rows()
    used_ids: set[str] = set()
    index_items: list[dict] = []

    POINTS_DIR.mkdir(parents=True, exist_ok=True)

    for row in rows:
        pid = slugify(row["title"], row["ref"], used_ids)
        rel = f"points/{pid}.md"
        fp = POINTS_DIR / f"{pid}.md"
        body = render_point_body(row, pid)
        if not args.dry_run:
            fp.write_text(body, encoding="utf-8")
        ch = parse_chapter(row["ref"])
        status = "正式" if pid in CONTENT_OVERRIDES else "草稿"
        index_items.append(
            {
                "id": pid,
                "title": row["title"],
                "path": rel,
                "status": status,
                "kind": "point",
                "group": row["group"],
                "outlineRef": row["ref"],
                **({"chapter": ch} if ch else {}),
                "note": row["ref"][:48],
            }
        )

    if args.merge_index and not args.dry_run:
        merge_index(index_items)

    print({"points": len(index_items), "dir": str(POINTS_DIR.relative_to(ROOT)), "merge": args.merge_index})


if __name__ == "__main__":
    main()
