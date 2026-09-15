#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Merge option-level explanation patches into 综合知识/all.jsonl (+ 上午真题镜像).

Patches: content/banks/real/综合知识/exp-patches/*.jsonl
Each line: {"id": "...", "opt_exp": {"A":"...","B":"...","C":"...","D":"..."}, "exp": "..."}
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BANK = ROOT / "content/banks/real/综合知识/all.jsonl"
LEGACY = ROOT / "content/banks/real/上午真题.jsonl"
PATCH_DIR = ROOT / "content/banks/real/综合知识/exp-patches"


def build_exp_from_opt(opt_exp: dict, ans: str) -> str:
    parts = []
    if ans in opt_exp:
        parts.append(opt_exp[ans].lstrip("对：").lstrip("对:").strip())
    wrongs = []
    for k in "ABCD":
        if k == ans or k not in opt_exp:
            continue
        t = opt_exp[k]
        t = t.lstrip("错：").lstrip("错:").strip()
        wrongs.append(f"{k} {t}")
    if wrongs:
        parts.append("；".join(wrongs))
    return "".join(
        [
            "【正解】" + (parts[0] if parts else ""),
            ("【易错】" + parts[1]) if len(parts) > 1 else "",
        ]
    )


def main() -> None:
    PATCH_DIR.mkdir(parents=True, exist_ok=True)
    patches: dict[str, dict] = {}
    for fp in sorted(PATCH_DIR.glob("*.jsonl")):
        for ln in fp.read_text(encoding="utf-8").splitlines():
            if not ln.strip():
                continue
            o = json.loads(ln)
            qid = o.get("id")
            if not qid:
                continue
            patches[qid] = o
        print(f"loaded {fp.name}: running total {len(patches)} ids")

    if not patches:
        print("no patches in", PATCH_DIR)
        return

    rows = [json.loads(l) for l in BANK.read_text(encoding="utf-8").splitlines() if l.strip()]
    n_upd = 0
    for r in rows:
        p = patches.get(r["id"])
        if not p:
            continue
        opt_exp = p.get("opt_exp") or {}
        if opt_exp:
            r["opt_exp"] = {k: str(opt_exp[k]).strip() for k in "ABCD" if k in opt_exp and opt_exp[k]}
        exp = (p.get("exp") or "").strip()
        if not exp and r.get("opt_exp"):
            exp = build_exp_from_opt(r["opt_exp"], r.get("ans") or "")
        if exp:
            r["exp"] = exp
        r["exp_edition"] = p.get("exp_edition") or "kb-opt-v1"
        n_upd += 1

    text = "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n"
    BANK.write_text(text, encoding="utf-8")
    LEGACY.write_text(text, encoding="utf-8")
    covered = sum(1 for r in rows if (r.get("opt_exp") or r.get("exp")))
    print(f"updated {n_upd} from patches; bank covered {covered}/{len(rows)}")


if __name__ == "__main__":
    main()
