#!/usr/bin/env python3
"""Merge content banks + workshop → public/data/questions.json (compat wrapper)."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BANKS = ROOT / "content/banks"
NEW = ROOT / "content/workshop/new"
REVIEW = ROOT / "content/workshop/review"
OUT = ROOT / "public/data"

def load_jsonl(path: Path):
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]

def main():
    practice = []
    for o in load_jsonl(BANKS / "practice/all.jsonl"):
        practice.append({
            "no": o["no"], "ch": o.get("chapter", 0), "point": o.get("point", ""),
            "stem": o["stem"], "opts": o.get("options") or o.get("opts"),
            "ans": o.get("answer") or o.get("ans"),
            "exp": o.get("explain", ""), "diff": o.get("difficulty", "basic"),
            "bank": "practice", "source": "自编练习", "year": "",
        })
    real = []
    for i, q in enumerate(load_jsonl(BANKS / "real/上午真题.jsonl"), 1):
        real.append({
            "no": 100000 + i, "ch": 99,
            "point": f"{q.get('year','')}{('年'+q['half']+'半年') if q.get('half') else ''}·第{q.get('qnum','')}题",
            "stem": q["stem"], "opts": q["opts"], "ans": q["ans"],
            "exp": q.get("exp") or q.get("source", ""),
            "diff": "real", "bank": "real", "source": q.get("source", "真题"),
            "year": str(q.get("year", "")), "qnum": q.get("qnum"),
        })
    workshop = []
    n = 200000
    candidates = [fp for fp in NEW.glob("*.jsonl") if not fp.name.startswith("重写") and ".bak" not in fp.name]
    passed = {fp.name for fp in candidates if fp.name.endswith("-passed.jsonl")}
    files = []
    for fp in sorted(candidates):
        if fp.name.endswith("-passed.jsonl"):
            files.append(fp)
            continue
        if (fp.stem + "-passed.jsonl") in passed:
            continue
        files.append(fp)
    reject = set()
    rej_file = REVIEW / "reject-ids.txt"
    if rej_file.exists():
        reject = {ln.strip() for ln in rej_file.read_text(encoding="utf-8").splitlines() if ln.strip()}
    for fp in files:
        for i, o in enumerate(load_jsonl(fp), 1):
            qid = o.get("id") or f"{fp.stem}-{i:02d}"
            if qid in reject and "passed" not in fp.name:
                continue
            n += 1
            workshop.append({
                "no": n, "ch": o.get("chapter", 0), "point": o.get("point", ""),
                "stem": o["stem"], "opts": o.get("options") or o.get("opts"),
                "ans": o.get("answer") or o.get("ans"),
                "exp": o.get("explain") or o.get("exp", ""),
                "diff": o.get("difficulty", "deep"),
                "bank": "workshop", "source": o.get("source", fp.stem), "year": "",
                "id": qid,
            })
    combined = practice + real + workshop
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {"practice": len(practice), "real": len(real), "workshop": len(workshop), "total": len(combined)}
    (OUT / "questions.json").write_text(json.dumps(combined, ensure_ascii=False), encoding="utf-8")
    (OUT / "question-meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(meta)

if __name__ == "__main__":
    main()
