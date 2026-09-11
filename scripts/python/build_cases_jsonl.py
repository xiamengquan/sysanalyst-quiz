#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convert content/banks/cases/案例*.md → all.jsonl + public/data/cases.json"""
from __future__ import annotations
import json, re
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[2]
CASE_DIR = ROOT / "content/banks/cases"
OUT_DATA = ROOT / "public/data"

DOMAIN_CHAPTER = {
    "Web": 16, "移动": 18, "微服务": 20, "大数据": 19,
    "嵌入式": 17, "CPS": 21, "集成": 12, "架构": 12,
    "需求": 11, "测试": 14, "安全": 9, "运维": 15, "数据库": 5,
}
TYPE_ANSWER = {
    "方案对比": "compare",
    "架构设计": "design",
    "分析改进": "design",
}

def parse_md(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"#\s*案例(\d+)\s*·\s*(.+?)\s*·\s*(.+)\s*$", text.splitlines()[0].strip())
    if not m:
        raise ValueError(f"bad title: {path.name}")
    no = int(m.group(1))
    domain = m.group(2).strip()
    case_type = m.group(3).strip()

    def section(name: str) -> str:
        pat = rf"##\s*{re.escape(name)}\s*\n(.*?)(?=\n##\s|\Z)"
        sm = re.search(pat, text, re.S)
        return (sm.group(1).strip() if sm else "")

    # meta: > track: P0 · stop_loss · depth: deep
    track, stop_loss, depth = "P1", False, "standard"
    meta_m = re.search(r"^>\s*(.+)$", text, re.M)
    if meta_m:
        meta = meta_m.group(1)
        tm = re.search(r"track:\s*(P[012])", meta)
        if tm:
            track = tm.group(1)
        stop_loss = "stop_loss" in meta
        dm = re.search(r"depth:\s*(\w+)", meta)
        if dm:
            depth = dm.group(1)

    stem = section("题干")
    qblock = section("问题")
    rblock = section("参考作答要点（非唯一答案）") or section("参考作答要点")

    prompts = re.findall(r"\*\*问题(\d+)\*\*\s*(.+?)(?=\n\*\*问题|\Z)", qblock, re.S)
    rubrics = re.findall(r"\*\*问题(\d+)要点[：:]\*\*\s*(.+?)(?=\n\*\*问题|\n\*\*领域|\Z)", rblock, re.S)
    rub_map = {int(n): t.strip() for n, t in rubrics}
    domain_hint = ""
    dh = re.search(r"\*\*领域提示[：:]\*\*\s*(.+)", rblock)
    if dh:
        domain_hint = dh.group(1).strip()

    questions = []
    for n, prompt in prompts:
        qn = int(n)
        sample = rub_map.get(qn, "")
        must = []
        for kw in ["耦合", "扩展", "成本", "风险", "一致性", "缓存", "限流", "幂等", "灰度", "监控", "回滚",
                   "击穿", "穿透", "BFF", "熔断", "契约", "主数据", "止损"]:
            if kw in sample or kw in prompt or kw in stem:
                must.append(kw)
        questions.append({
            "qnum": qn,
            "prompt": prompt.strip(),
            "answer_type": TYPE_ANSWER.get(case_type, "short"),
            "word_limit": 200 if "200字" in prompt else 0,
            "rubric": {"must_hit": must[:8], "sample": sample},
            "hint": domain_hint or "回扣题干约束；措施具体可落地",
        })

    return {
        "no": no,
        "id": f"CA-{no:03d}",
        "subject": "case",
        "bank": "case",
        "chapter": DOMAIN_CHAPTER.get(domain, 16),
        "domain": domain,
        "case_type": case_type,
        "point": f"{domain} · {case_type}",
        "track": track,
        "stop_loss": stop_loss,
        "depth": depth,
        "stem": stem,
        "questions": questions,
        "source": "自编案例分析",
        "year": "",
        "time_limit_min": 25,
        "file": path.name,
    }

def main():
    files = sorted(CASE_DIR.glob("案例*.md"), key=lambda p: int(re.search(r"\d+", p.stem).group()))
    cases = [parse_md(fp) for fp in files]
    OUT_DATA.mkdir(parents=True, exist_ok=True)
    (CASE_DIR / "all.jsonl").write_text(
        "\n".join(json.dumps(c, ensure_ascii=False) for c in cases) + "\n",
        encoding="utf-8",
    )
    meta = {
        "practice": len(cases),
        "real": 0,
        "total": len(cases),
        "domains": dict(Counter(c["domain"] for c in cases)),
        "types": dict(Counter(c["case_type"] for c in cases)),
        "tracks": dict(Counter(c["track"] for c in cases)),
        "stop_loss": sum(1 for c in cases if c.get("stop_loss")),
    }
    (OUT_DATA / "cases.json").write_text(json.dumps(cases, ensure_ascii=False), encoding="utf-8")
    (OUT_DATA / "case-meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print({"n": len(cases), "meta": meta})

if __name__ == "__main__":
    main()
