#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为缺 override 的 API 考点生成 kb_def_overrides.json 条目（编制乙·定义/作用）。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

import refine_kb_api_points as r  # noqa: E402

INDEX = ROOT / "content/kb-index.json"
OV_PATH = Path(__file__).resolve().parent / "kb_def_overrides.json"
MIN_LEN = 140
SKIP = r.SKIP_IDS


def load_items() -> list[dict]:
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    for sec in data.get("sections", []):
        if sec.get("id") == "api-ref":
            return list(sec.get("items") or [])
    return []


def build_raw(item: dict, items: list[dict], slices: dict) -> str:
    pid = item["id"]
    ch_text = ""
    if item.get("chapter"):
        cf = r.find_chapter_file(int(item["chapter"]))
        if cf:
            ch_text = cf.read_text(encoding="utf-8")
    essay_first = (
        pid.startswith("kp-论文专题")
        or pid in r.ESSAY_MULTI_CH
        or pid in r.ESSAY_SYNTHETIC
        or pid in ("kp-内容", "kp-注意事项-解答步骤-摘要正文-评分")
    )
    if essay_first:
        raw = (
            r.essay_group_raw(item, items)
            or r.multi_chapter_raw(pid)
            or r.ESSAY_SYNTHETIC.get(pid, "")
            or r.ch22_text()[:6500]
        )
    else:
        raw = r.force_extract(pid) or slices.get(pid, "") or ""
    if raw and ch_text and not essay_first:
        raw = r.supplement_raw(raw, item, ch_text)
    if not raw or (len(raw.strip()) < r.RAW_MIN_QUALITY and pid in r.SYNTHETIC_POINTS):
        raw = r.SYNTHETIC_POINTS.get(pid, "") or raw
    if not raw:
        raw = r.special_raw(pid)
    if not raw and ch_text:
        raw = r.chapter_context_blob(
            ch_text, r.title_keywords(item.get("title", ""))
        ) or ch_text[:4000]
    return raw or ""


def defs_from_point_file(pid: str) -> str:
    fp = r.POINTS / f"{pid}.md"
    if not fp.exists():
        return ""
    import re

    text = fp.read_text(encoding="utf-8")
    mm = re.search(r"## 定义\n\n([\s\S]*?)\n\n## 要点", text)
    return mm.group(1).strip() if mm else ""


def main() -> None:
    overrides = json.loads(OV_PATH.read_text(encoding="utf-8"))
    items = load_items()
    slices = r.assign_slices(items)
    added = 0
    skipped = 0
    for it in items:
        pid = it["id"]
        if pid in SKIP or pid in overrides:
            continue
        if pid.startswith("kp-论文专题") or pid == "kp-内容":
            continue
        ch_text = ""
        ch_num = None
        if it.get("chapter"):
            ch_num = int(it["chapter"])
            cf = r.find_chapter_file(ch_num)
            if cf:
                ch_text = cf.read_text(encoding="utf-8")
        raw = build_raw(it, items, slices)
        title = it.get("title", "")
        keys = r.title_keywords(title)
        defs = ""
        if raw.strip():
            defs = r.finalize_definitions(pid, raw, title, keys, ch_text, ch_num)
        if r.definition_text_len(defs) < MIN_LEN:
            defs = defs_from_point_file(pid)
        if not raw.strip() and r.definition_text_len(defs) < 100:
            skipped += 1
            continue
        if r.definition_text_len(defs) < 100:
            skipped += 1
            continue
        if not r._def_has_what(defs) or not __import__("re").search(
            r"(作用|用于|主要用于)", defs
        ):
            skipped += 1
            continue
        overrides[pid] = defs.strip()
        added += 1
    OV_PATH.write_text(
        json.dumps(dict(sorted(overrides.items())), ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print({"added": added, "skipped": skipped, "total_overrides": len(overrides)})


if __name__ == "__main__":
    main()
