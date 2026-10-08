#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为所有缺「## 七步法」的自编案例 MD 批量补齐（复用 add_seven_steps_wuxuan 生成器）。"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from add_seven_steps_wuxuan import (  # noqa: E402
    build_seven_md,
    extract_questions,
    extract_rubrics,
    parse_header,
    strip_seven,
)

CASE_DIR = ROOT / "content/banks/cases"


def section(text: str, name: str) -> str:
    pat = rf"##\s*{re.escape(name)}\s*\n(.*?)(?=\n##\s|\Z)"
    import re as _re
    sm = _re.search(pat, text, _re.S)
    return (sm.group(1).strip() if sm else "")


def main() -> None:
    files = sorted(CASE_DIR.glob("案例*.md"), key=lambda p: int(re.search(r"\d+", p.stem).group()))
    added, skipped = [], []
    for fp in files:
        text = fp.read_text(encoding="utf-8")
        if "## 七步法" in text:
            continue
        no, domain, case_type = parse_header(text.splitlines()[0])
        stem = section(text, "题干")
        qblock = section(text, "问题")
        rblock = section(text, "参考作答要点（非唯一答案）") or section(text, "参考作答要点")
        meta_line = ""
        mm = re.search(r"^>\s*(.+)$", text, re.M)
        if mm:
            meta_line = mm.group(1)
        track = ""
        tm = re.search(r"track:\s*(P[012])", meta_line)
        if tm:
            track = tm.group(1)
        pack_role = {
            "P0": "自编练习 · 推荐主攻（P0）",
            "P1": "自编练习 · P1 保底",
            "P2": "自编练习 · P2 止损",
        }.get(track, "自编练习 · 按领域/题型筛选")

        questions = extract_questions(qblock)
        if not questions:
            skipped.append(fp.name)
            continue
        rubrics = extract_rubrics(rblock)
        md = build_seven_md(
            no=no,
            domain=domain,
            case_type=case_type,
            stem=stem,
            questions=questions,
            rubrics=rubrics,
            pack_role=pack_role,
        )
        fp.write_text(strip_seven(text).rstrip() + "\n\n" + md, encoding="utf-8")
        added.append(fp.name)

    print({"added": len(added), "skipped_no_questions": skipped})


if __name__ == "__main__":
    main()