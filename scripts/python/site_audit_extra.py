#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全站复审 · 补充专项审计 v2（修正镜像/路由映射后）。

A. KB 内链死链：/kb/<x> 按 kb-index id + 别名表解析；相对路径按文件解析；锚点比对
B. 镜像一致性：public/kb 树 + public/data/kb-md/<id>.md + kb-html/<id>.html
C. mock-sets × questions.json 交叉校验
D. 旧节名残留分类（points 实残 / 章节合法 / 速查引用）+ §引用中指向旧节名的
E. 空定义/截断句/残表扫描
F. 练习入口 chapter 有效性
"""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KB = ROOT / "content/kb"
ISSUES: list[dict] = []
STATS: Counter = Counter()


def add(kind: str, where: str, detail: str) -> None:
    ISSUES.append({"kind": kind, "where": where, "detail": detail})
    STATS[kind] += 1


def norm(p: Path) -> str:
    try:
        return str(p.resolve()).replace(str(ROOT.resolve()), "")
    except OSError:
        return str(p)


index = json.loads((ROOT / "content/kb-index.json").read_text(encoding="utf-8"))
items = [it for sec in index.get("sections", []) for it in sec.get("items", [])]
id2path = {it["id"]: it["path"] for it in items if it.get("id") and it.get("path")}
alias = json.loads((ROOT / "src/lib/kb-slug-canonical-map.json").read_text(encoding="utf-8"))
valid_slugs = set(id2path) | set(alias)
kb_files = [p for p in KB.rglob("*.md")]
kb_paths = {norm(p) for p in kb_files}
anchor_cache: dict[str, set] = {}

# ---------- A. 内链 ----------
link_re = re.compile(r"\[([^\]]*)\]\(([^)#\s]+)(#[^)]*)?\)")
for p in kb_files:
    t = p.read_text(encoding="utf-8")
    rel = str(p.relative_to(ROOT))
    base = p.parent
    for _label, target, frag in link_re.findall(t):
        if target.startswith(("http://", "https://", "mailto:")):
            continue
        if target.startswith("/?"):
            continue
        if target.startswith("/kb/"):
            slug = target[4:].strip("/")
            if slug and slug not in valid_slugs:
                add("站点路径死链", rel, target)
        elif target.startswith("/"):
            rest = target[1:]
            if not (ROOT / "public" / rest).exists() and not (ROOT / "out" / rest).exists():
                add("站点路径死链", rel, target)
        else:
            resolved = (base / target).resolve()
            r = norm(resolved)
            if r not in kb_paths:
                add("相对死链", rel, target)
            elif frag:
                key = norm(resolved)

                def site_slug(h: str) -> str:
                    s = re.sub(r"[`*_~]", "", h.strip().lower())
                    s = re.sub(r"\s+", "-", s)
                    s = re.sub(r"[^\w\u4e00-\u9fff-]", "", s)
                    return s[:80]

                if key not in anchor_cache:
                    anchor_cache[key] = {site_slug(h.lstrip("#")) for h in resolved.read_text(encoding="utf-8").splitlines() if h.startswith("#")}
                a = site_slug(frag.lstrip("#").strip())
                if a and a not in anchor_cache[key]:
                    add("锚点失配", rel, f"{target}{frag}")

# ---------- B. 镜像 ----------
pub_kb = ROOT / "public/kb"
flat_md = ROOT / "public/data/kb-md"
flat_html = ROOT / "public/data/kb-html"
for iid, rel_path in id2path.items():
    src = KB / rel_path
    if not src.exists():
        add("索引缺源文件", iid, rel_path)
        continue
    m1 = pub_kb / rel_path
    if not m1.exists() or m1.read_text(encoding="utf-8") != src.read_text(encoding="utf-8"):
        add("public/kb 不一致", iid, rel_path)
    m2 = flat_md / f"{iid}.md"
    if not m2.exists() or m2.read_text(encoding="utf-8") != src.read_text(encoding="utf-8"):
        add("kb-md 不一致", iid, rel_path)
    m3 = flat_html / f"{iid}.html"
    if not m3.exists():
        add("kb-html 缺失", iid, rel_path)
    else:
        first = next((l for l in src.read_text(encoding="utf-8").splitlines() if l.startswith("# ")), "")
        probe = first[2:].split("（")[0][:12] if first else ""
        if probe and probe not in m3.read_text(encoding="utf-8"):
            add("kb-html 疑似过期", iid, probe)

# ---------- C. mock-sets ----------
qs = json.loads((ROOT / "public/data/questions.json").read_text(encoding="utf-8"))
qid = {str(q.get("id")) for q in qs}
mock = json.loads((ROOT / "public/data/mock-sets.json").read_text(encoding="utf-8"))
allids = []
for s in mock.get("sets", []):
    ids = [it["id"] for it in s["items"]]
    allids += ids
    if len(ids) != 75:
        add("mock套题数", s["id"], str(len(ids)))
    if len(set(ids)) != len(ids):
        add("mock套内重复", s["id"], "")
    miss = [i for i in ids if i not in qid]
    if miss:
        add("mock引用缺失", s["id"], ",".join(miss[:5]))
if len(allids) != len(set(allids)):
    add("mock跨套复用", "sets", str(len(allids) - len(set(allids))))
if not (ROOT / "out/data/mock-sets.json").exists():
    add("out缺产物", "out/data/mock-sets.json", "")
else:
    if json.loads((ROOT / "out/data/mock-sets.json").read_text(encoding="utf-8")) != mock:
        add("out mock-sets 与源不一致", "", "")

# ---------- D. 旧节名/§引用 分类 ----------
for p in kb_files:
    t = p.read_text(encoding="utf-8")
    rel = str(p.relative_to(ROOT))
    top = rel.split("/")[2] if rel.startswith("/content/kb/") else ""
    in_points = top == "points"
    for m in re.finditer(r"易混对比", t):
        ln = t[: m.start()].count("\n") + 1
        line = t.splitlines()[ln - 1].strip()
        is_heading = line.startswith("#")
        if in_points:
            add("旧节名残留(points)", f"{rel}:{ln}", line[:60])
        elif is_heading and not in_points and top in ("第一篇-基础知识", "第二篇-关键技术", "第三篇-案例实践"):
            STATS["章文件合法节名"] += 1
        else:
            add("旧节名引用(非points)", f"{rel}:{ln}", line[:60])
    for m in re.finditer(r"§[^\s，。；）)]{1,10}", t):
        ln = t[: m.start()].count("\n") + 1
        line = t.splitlines()[ln - 1].strip()
        if "易混对比" in line or "本章考什么" in line:
            add("§引用指向旧节名", f"{rel}:{ln}", line[:60])
        else:
            STATS["§引用(信息级)"] += 1

# ---------- E. 空定义/截断 ----------
suspects = [
    (r"\*\*：。\s*$", "空定义"),
    (r"（应试）\*\*：。", "空应试条目"),
    (r"^\|-+\|[^|]*$", "残缺分隔行"),
    (r"^\| [^|]+\|\s*$", "残缺数据行"),
]
for p in kb_files:
    t = p.read_text(encoding="utf-8")
    rel = str(p.relative_to(ROOT))
    for pat, label in suspects:
        for m in re.finditer(pat, t, re.M):
            ln = t[: m.start()].count("\n") + 1
            add(label, f"{rel}:{ln}", t.splitlines()[ln - 1].strip()[:60])

# ---------- F. 练习入口 ----------
chap_ok = {int(q["ch"]) for q in qs if q.get("bank") == "practice"}
for p in kb_files:
    t = p.read_text(encoding="utf-8")
    for m in re.finditer(r"chapter=(\d+)", t):
        c = int(m.group(1))
        if c not in chap_ok and c != 99:
            add("练习chapter无效", str(p.relative_to(ROOT)), f"chapter={c}")

# ---------- 汇总 ----------
print({"files": len(kb_files), "issues": len(ISSUES)})
for k, v in STATS.most_common():
    print(f"  {k}: {v}")
out = ROOT / "docs/web-team/audit" / f"全站复审-专项-{date.today().isoformat()}.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({"date": date.today().isoformat(), "stats": dict(STATS), "issues": ISSUES}, ensure_ascii=False, indent=2), encoding="utf-8")
print("报告 →", out.relative_to(ROOT))