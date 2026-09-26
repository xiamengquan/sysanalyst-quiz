#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""刷新案例分析真题 point（列表标题：卷面 · 领域 · 题型）。"""
from __future__ import annotations

import json
from pathlib import Path

from case_point_lib import format_real_case_point

ROOT = Path(__file__).resolve().parents[2]
JSONL = ROOT / "content/banks/real/案例分析/all.jsonl"


def main() -> None:
    rows = [json.loads(line) for line in JSONL.read_text(encoding="utf-8").splitlines() if line.strip()]
    changed = 0
    for row in rows:
        if row.get("bank") != "real":
            continue
        new_point = format_real_case_point(row)
        if row.get("point") != new_point:
            changed += 1
            row["point"] = new_point
    JSONL.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    print({"total": len(rows), "point_updated": changed})


if __name__ == "__main__":
    main()
