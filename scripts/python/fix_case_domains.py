#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校正案例分析真题 domain/chapter，并重写 seven_steps。"""
from __future__ import annotations

import json
from pathlib import Path

from case_domain_lib import infer_case_domain, infer_case_type
from seven_steps_lib import build_seven_steps

ROOT = Path(__file__).resolve().parents[2]
JSONL = ROOT / "content/banks/real/案例分析/all.jsonl"
REPORT = ROOT / "docs/question-workshop/reports/案例分析领域校正-2026-09-25-规划.md"


def pack_role(row: dict) -> str:
    exam = int(row.get("exam_no") or 0)
    year = f"{row.get('year', '')}{row.get('half', '')}"
    if exam == 1:
        return f"真题 {year} · 试题一（建议必答）"
    return f"真题 {year} · 试题{exam}（选答候选；60 秒扫标题再定）"


def main() -> None:
    rows = [json.loads(line) for line in JSONL.read_text(encoding="utf-8").splitlines() if line.strip()]
    changes: list[dict] = []
    for row in rows:
        prompts = [str(q.get("prompt") or "") for q in row.get("questions") or []]
        ch, domain = infer_case_domain(
            row.get("stem") or "",
            row.get("point") or "",
            prompts,
            case_id=str(row.get("id") or ""),
        )
        old_d, old_ch = row.get("domain"), row.get("chapter")
        if old_d != domain or old_ch != ch:
            changes.append(
                {
                    "id": row.get("id"),
                    "from": f"{old_d}·ch{old_ch}",
                    "to": f"{domain}·ch{ch}",
                }
            )
        row["domain"] = domain
        row["chapter"] = ch
        row["case_type"] = infer_case_type(row.get("stem") or "")
        row["seven_steps"] = build_seven_steps(
            case_id=row.get("id") or "",
            domain=row.get("domain") or "Web",
            case_type=row.get("case_type") or "分析改进",
            stem=row.get("stem") or "",
            questions=row.get("questions") or [],
            pack_role=pack_role(row),
        )

    JSONL.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )

    lines = [
        "# 案例分析真题 · 领域标签校正（可行性→系统规划）",
        "",
        f"- 校正条数：**{len(changes)}** / {len(rows)}",
        "- 规则：`case_domain_lib` 新增 **系统规划·ch10**；可行性/NPV/ERP 规划不再归入需求工程",
        "",
        "## 变更清单",
        "",
    ]
    for c in changes:
        lines.append(f"- `{c['id']}`：{c['from']} → **{c['to']}**")
    if not changes:
        lines.append("- （无）")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print({"total": len(rows), "changed": len(changes), "report": str(REPORT.relative_to(ROOT))})


if __name__ == "__main__":
    main()
