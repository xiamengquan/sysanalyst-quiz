#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为案例分析真题 all.jsonl 写入 seven_steps。"""
from __future__ import annotations

import json
from pathlib import Path

from seven_steps_lib import build_seven_steps

ROOT = Path(__file__).resolve().parents[2]
JSONL = ROOT / "content/banks/real/案例分析/all.jsonl"


def pack_role(row: dict) -> str:
    exam = int(row.get("exam_no") or 0)
    year = f"{row.get('year', '')}{row.get('half', '')}"
    if exam == 1:
        return f"真题 {year} · 试题一（建议必答）"
    return f"真题 {year} · 试题{exam}（选答候选；60 秒扫标题再定）"


def main() -> None:
    rows = [json.loads(line) for line in JSONL.read_text(encoding="utf-8").splitlines() if line.strip()]
    for row in rows:
        row["seven_steps"] = build_seven_steps(
            case_id=row.get("id") or "",
            domain=row.get("domain") or "Web",
            case_type=row.get("case_type") or "简答",
            stem=row.get("stem") or "",
            questions=row.get("questions") or [],
            pack_role=pack_role(row),
        )
    JSONL.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )
    print({"updated": len(rows), "sample": rows[0]["id"], "steps": len(rows[0]["seven_steps"])})


if __name__ == "__main__":
    main()
