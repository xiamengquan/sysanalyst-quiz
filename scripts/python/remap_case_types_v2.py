#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将 cases/all.jsonl 的 case_type 迁移为 2026 考纲四类题型。"""
from __future__ import annotations

import json
from pathlib import Path

from case_domain_lib import normalize_case_type

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / "content/banks/cases/all.jsonl",
    ROOT / "content/banks/real/案例分析/all.jsonl",
]


def remap_file(jsonl: Path) -> dict[str, int]:
    if not jsonl.exists():
        return {}
    lines = jsonl.read_text(encoding="utf-8").splitlines()
    out: list[str] = []
    counts: dict[str, int] = {}
    for line in lines:
        if not line.strip():
            continue
        row = json.loads(line)
        stem = row.get("stem") or ""
        old = row.get("case_type") or ""
        prompts = row.get("questions") or []
        extra = "\n".join(
            q.get("prompt", "") for q in prompts if isinstance(q, dict)
        )
        new = normalize_case_type(old, stem, extra)
        row["case_type"] = new
        if row.get("point") and " · " in str(row["point"]):
            parts = str(row["point"]).split(" · ")
            parts[-1] = new
            row["point"] = " · ".join(parts)
        counts[new] = counts.get(new, 0) + 1
        out.append(json.dumps(row, ensure_ascii=False))
    jsonl.write_text("\n".join(out) + "\n", encoding="utf-8")
    return counts


def main() -> None:
    for jsonl in TARGETS:
        counts = remap_file(jsonl)
        if counts:
            print(jsonl.relative_to(ROOT), counts)


if __name__ == "__main__":
    main()
