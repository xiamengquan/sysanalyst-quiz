#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将篇章合订正文一次性切分迁移至 content/kb/points/kp-*.md（API 六节）。"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KB = ROOT / "content/kb"
POINTS = KB / "points"
INDEX = ROOT / "content/kb-index.json"
QUICK_TABLE = KB / "速查/高频对比速查表.md"

SKIP_IF_NO_PLACEHOLDER = True  # 已编制正文（无「待编制」）则跳过

EXCLUDE_H2 = re.compile(
    r"本章考什么|易混对比|应试钩子|与综合知识关联|使用说明|Dev Docs|篇索引|分章速查"
)

DEF_RE = re.compile(
    r"^\*\*(.+?)（答卷·(?:定义|必背)）\*\*：?\s*(.*)$", re.M
)
ACT_RE = re.compile(
    r"^\*\*(.+?)（答卷·作用）\*\*：?\s*(.*)$", re.M
)

# 无教程章节的考点：整篇或速查来源
SPECIAL_BODY: dict[str, tuple[str, str | None]] = {
    "kp-开源社区-许可-语言平台-框架库-服务器-工具-评估": (
        "第一篇-基础知识/第07章-软件工程.md",
        "### 开发环境与工具",
    ),
    "kp-开源软件": ("案例分析答题教程.md", None),
    "kp-标准类型-生命周期-知识产权": (
        "第一篇-基础知识/第06章-企业信息化.md",
        "### 信息资源管理(IRM)",
    ),
    "kp-企业法律制度-会计-财务成本-组织-HR-文化-IT-审计": (
        "第一篇-基础知识/第08章-项目管理.md",
        "## 二、",
    ),
    "kp-概率统计-图论-预测决策-数学建模-工程伦理": (
        "第一篇-基础知识/第02章-数学与工程基础.md",
        None,
    ),
    "kp-英文阅读-领域术语": (
        "第一篇-基础知识/第01章-绪论.md",
        None,
    ),
    "kp-注意事项-解答步骤-摘要正文-评分": (
        "第三篇-案例实践/第22章-系统分析师论文写作要点.md",
        "### 4.",
    ),
    "kp-内容": ("案例分析答题教程.md", "## 一、"),
}

CHAPTER_QUICK: dict[int, list[str]] = {
    2: ["速查/前端友好-数学白话卡.md"],
    4: ["速查/REST架构风格-体系化学习卡.md"],
    11: ["速查/需求工程-体系化学习路径.md", "速查/案例必答-需求获取五法对比卡.md"],
    12: ["速查/Web与AI智能体-架构选型四维度卡.md"],
    7: ["速查/UML-体系化学习指南.md"],
}


def load_index_points() -> list[dict]:
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    for sec in data.get("sections", []):
        if sec.get("id") == "api-ref":
            return list(sec.get("items") or [])
    return []


def find_chapter_file(ch: int) -> Path | None:
    for p in KB.rglob("*.md"):
        if p.parts[-1].startswith(f"第{ch:02d}章-") or p.parts[-1].startswith(f"第{ch}章-"):
            if "points" not in p.parts:
                return p
    return None


def split_h2_blocks(text: str) -> list[tuple[str, str]]:
    m = re.search(r"^##\s", text, re.M)
    if not m:
        return []
    text = text[m.start() :]
    lines = text.splitlines()
    blocks: list[tuple[str, str]] = []
    cur_title = ""
    cur: list[str] = []
    for line in lines:
        if line.startswith("## ") and not line.startswith("### "):
            if cur_title:
                blocks.append((cur_title, "\n".join(cur).strip()))
            cur_title = line[3:].strip()
            cur = []
            continue
        if cur_title:
            cur.append(line)
    if cur_title:
        blocks.append((cur_title, "\n".join(cur).strip()))
    return blocks


def split_h3_blocks(body: str) -> list[str]:
    parts: list[str] = []
    cur: list[str] = []
    for line in body.splitlines():
        if line.startswith("### "):
            if cur:
                parts.append("\n".join(cur).strip())
            cur = [line]
        else:
            cur.append(line)
    if cur:
        parts.append("\n".join(cur).strip())
    return [p for p in parts if p]


def filter_blocks(blocks: list[tuple[str, str]]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for title, body in blocks:
        if EXCLUDE_H2.search(title):
            continue
        if not body.strip():
            continue
        out.append((title, body))
    return out


def atomic_slices(blocks: list[tuple[str, str]]) -> list[str]:
    atoms: list[str] = []
    for title, body in blocks:
        subs = split_h3_blocks(body)
        if len(subs) > 1:
            atoms.extend(subs)
        else:
            atoms.append(f"## {title}\n\n{body}".strip())
    return atoms


def merge_to_count(pieces: list[str], n: int) -> list[str]:
    if n <= 0:
        return []
    if len(pieces) == n:
        return pieces
    if len(pieces) > n:
        while len(pieces) > n:
            # 合并最短相邻对
            best_i, best_len = 0, 10**9
            for i in range(len(pieces) - 1):
                L = len(pieces[i]) + len(pieces[i + 1])
                if L < best_len:
                    best_len, best_i = L, i
            pieces[best_i : best_i + 2] = [
                pieces[best_i].rstrip() + "\n\n" + pieces[best_i + 1].lstrip()
            ]
        return pieces
    # len < n: 拆分最长块
    while len(pieces) < n and pieces:
        idx = max(range(len(pieces)), key=lambda i: len(pieces[i]))
        chunk = pieces.pop(idx)
        mid = len(chunk) // 2
        cut = chunk.rfind("\n\n", 0, mid)
        if cut < 80:
            cut = mid
        pieces[idx : idx] = [chunk[:cut].strip(), chunk[cut:].strip()]
    return pieces


def refs_for_chapter(items: list[dict], ch: int) -> list[str]:
    refs: list[str] = []
    for it in items:
        ref = (it.get("outlineRef") or "").strip()
        if not re.match(r"^\d+\.\d+", ref):
            continue
        major = int(ref.split(".", 1)[0])
        if major == ch:
            refs.append(ref)
    # 保持 index 顺序
    seen: set[str] = set()
    ordered: list[str] = []
    for it in items:
        ref = (it.get("outlineRef") or "").strip()
        if ref in seen:
            continue
        if ref in refs:
            seen.add(ref)
            ordered.append(ref)
    return ordered


def slice_map_for_chapter(ch: int, items: list[dict]) -> dict[str, str]:
    path = find_chapter_file(ch)
    if not path:
        return {}
    text = path.read_text(encoding="utf-8")
    blocks = filter_blocks(split_h2_blocks(text))
    atoms = atomic_slices(blocks)
    refs = refs_for_chapter(items, ch)
    if not refs:
        return {}
    slices = merge_to_count(atoms, len(refs))
    return dict(zip(refs, slices))


def extract_chapter_extras(ch: int) -> tuple[str, str, str]:
    path = find_chapter_file(ch)
    if not path:
        return "", "", ""
    text = path.read_text(encoding="utf-8")
    exam = ""
    mix = ""
    intro = ""
    for title, body in split_h2_blocks(text):
        if "本章考什么" in title or title.startswith("一、本章"):
            intro = body.strip()
        elif "易混" in title:
            mix = body.strip()
        elif "应试" in title:
            exam = body.strip()
    return intro, mix, exam


def pick_quick_snippet(title: str, ch: int | None) -> str:
    if not QUICK_TABLE.exists():
        return ""
    text = QUICK_TABLE.read_text(encoding="utf-8")
    keys = [w for w in re.split(r"[^\w\u4e00-\u9fff]+", title) if len(w) >= 2][:3]
    if not keys:
        return ""
    for line in text.splitlines():
        if all(k in line for k in keys[:2]):
            return ""
    # 按章号找 ### 小节
    if ch:
        m = re.search(rf"###\s+{ch}\.\d+[^\n]*\n([\s\S]*?)(?=\n###|\n##|\Z)", text)
        if m:
            return m.group(0).strip()[:1200]
    return ""


def extract_definitions(raw: str) -> str:
    lines: list[str] = []
    for m in DEF_RE.finditer(raw):
        term, rest = m.group(1), m.group(2).strip()
        if rest:
            lines.append(f"- **{term}**：{rest}")
        else:
            # 下一非空行
            pass
    for m in ACT_RE.finditer(raw):
        term, rest = m.group(1), m.group(2).strip()
        if rest:
            lines.append(f"- **{term}（作用）**：{rest}")
    if not lines:
        for line in raw.splitlines():
            if "（答卷·定义）" in line or "（答卷·作用）" in line:
                lines.append(line.strip())
    return "\n".join(lines[:12]) if lines else "（见要点中的答卷句。）"


def build_overview(title: str, ch_intro: str, raw: str) -> str:
    clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    intro_line = ""
    for ln in (ch_intro or "").splitlines():
        t = ln.strip()
        if t and not t.startswith("|") and not t.startswith("-"):
            intro_line = t[:220]
            break
    first = ""
    for para in re.split(r"\n\s*\n", raw):
        p = para.strip()
        if p.startswith("###"):
            first = p.split("\n", 1)[0][4:].strip()[:120]
            break
        if p and not p.startswith("|") and not p.startswith("```") and not p.startswith("#"):
            first = p[:200]
            break
    if intro_line and first:
        return f"**{clean}** 属本科目大纲考点。{intro_line} 本节要点：{first}。"
    if intro_line:
        return f"**{clean}** 属本科目大纲考点。{intro_line}"
    return f"**{clean}** 为大纲规定考点，侧重概念辨析与案例/论文回扣。"


def scrub_body(raw: str) -> str:
    out: list[str] = []
    for line in raw.splitlines():
        if re.match(r"^#\s+第\d+章", line):
            continue
        if line.strip() == "##":
            continue
        out.append(line)
    return "\n".join(out).strip()


def related_links(item: dict, by_group: dict[str, list[dict]]) -> str:
    g = item.get("group") or ""
    ref = item.get("outlineRef") or ""
    ch = item.get("chapter")
    lines: list[str] = []
    sibs = sorted(by_group.get(g, []), key=lambda x: x.get("outlineRef") or "")
    idx = next((i for i, s in enumerate(sibs) if s["id"] == item["id"]), -1)
    for j in (idx - 1, idx + 1):
        if 0 <= j < len(sibs) and sibs[j]["id"] != item["id"]:
            s = sibs[j]
            st = re.sub(r"^\d+(?:\.\d+)*\s*", "", s.get("title", ""))[:48]
            lines.append(f"- [{st}](/kb/{s['id']})")
    if ch:
        cf = find_chapter_file(int(ch))
        if cf:
            rel = cf.relative_to(KB)
            lines.append(f"- 篇章合订（归档）：[`{rel.name}`](../{rel.as_posix()})")
    return "\n".join(lines) if lines else "- 同分组相邻考点见目录。"


def render_point(item: dict, raw: str, ch_intro: str, ch_mix: str, ch_exam: str) -> str:
    title = item["title"]
    ref = item.get("outlineRef") or "—"
    group = item.get("group") or ""
    ch = item.get("chapter")
    ch_line = f"第{ch}章" if ch else "—"
    h1 = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip() or title
    overview = build_overview(title, ch_intro, raw)
    defs = extract_definitions(raw)
    mix = ch_mix[:1500] if ch_mix else pick_quick_snippet(title, ch)
    if not mix.strip():
        mix = "（同章易混点见归档篇章「易混对比」节。）"
    exam_parts = []
    if ch_exam:
        exam_parts.append(ch_exam[:800])
    case_lines = [ln for ln in raw.splitlines() if "案例" in ln or "论文" in ln][:8]
    if case_lines:
        exam_parts.append("\n".join(f"- {ln.strip()}" for ln in case_lines))
    exam = "\n\n".join(exam_parts) if exam_parts else "（选择题抓题干信号词；案例按「约束→对比→结论」作答。）"
    points = scrub_body(raw)
    if len(points) > 8000:
        points = points[:8000] + "\n\n…（节选，完整见归档篇章。）"
    rel = related_links(item, by_group_cache)
    return f"""# {h1}

> **大纲**：{ref} · **教程**：{ch_line} · **分组**：{group}

## 概述

{overview}

## 定义

{defs}

## 要点

{points}

## 易混辨析

{mix}

## 应试

{exam}

## 相关考点

{rel}
"""


by_group_cache: dict[str, list[dict]] = {}


def special_raw(kp_id: str) -> str:
    if kp_id not in SPECIAL_BODY:
        return ""
    rel, anchor = SPECIAL_BODY[kp_id]
    path = KB / rel
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8")
    if not anchor:
        return text
    for title, body in split_h2_blocks(text):
        if anchor in title or (anchor.startswith("###") and anchor[4:] in title):
            return body
    if anchor.startswith("###"):
        for part in split_h3_blocks(text):
            if anchor[4:] in part.splitlines()[0]:
                return part
    return text[:4000]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="覆盖已有正文（含已编制条目）")
    args = ap.parse_args()

    global by_group_cache
    items = load_index_points()
    by_group_cache = defaultdict(list)
    for it in items:
        by_group_cache[it.get("group") or ""].append(it)

    # 预计算每章 ref -> slice
    chapters = {int(it["chapter"]) for it in items if it.get("chapter")}
    ch_slices: dict[str, str] = {}
    for ch in sorted(chapters):
        ch_slices.update(slice_map_for_chapter(ch, items))

    ch_extras: dict[int, tuple[str, str, str]] = {
        c: extract_chapter_extras(c) for c in chapters
    }

    migrated = 0
    skipped = 0
    for it in items:
        pid = it["id"]
        fp = POINTS / f"{pid}.md"
        if fp.exists() and SKIP_IF_NO_PLACEHOLDER and not args.force:
            old = fp.read_text(encoding="utf-8")
            if "待编制" not in old:
                skipped += 1
                continue
        if pid == "kp-2-7":
            skipped += 1
            continue

        ref = (it.get("outlineRef") or "").strip()
        raw = ch_slices.get(ref, "")
        ch = it.get("chapter")
        intro, mix, exam = ch_extras.get(int(ch), ("", "", "")) if ch else ("", "", "")

        if not raw and pid in SPECIAL_BODY:
            raw = special_raw(pid)
        if not raw and ch:
            path = find_chapter_file(int(ch))
            if path:
                raw = path.read_text(encoding="utf-8")[:6000]
        if not raw:
            raw = f"（大纲条目：{it.get('title')}；正文待从工坊补充。）"

        quick_extra = ""
        if ch and int(ch) in CHAPTER_QUICK:
            for q in CHAPTER_QUICK[int(ch)]:
                qp = KB / q
                if qp.exists():
                    quick_extra += f"\n\n> 扩展：[{qp.stem}](../{q})"
        if quick_extra:
            raw = raw + quick_extra

        doc = render_point(it, raw, intro, mix, exam)
        fp.write_text(doc, encoding="utf-8")
        it["status"] = "正式"
        it["note"] = "自篇章合订迁移"
        migrated += 1

    # 写回 index：api-ref + legacy 篇章
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    for sec in data["sections"]:
        if sec.get("id") == "api-ref":
            sec["items"] = items
        if sec.get("id") in ("part1", "part2", "part3"):
            for ent in sec.get("items") or []:
                if ent.get("kind") == "chapter":
                    ent["kind"] = "legacy"
                    ent["status"] = "归档"
                    ent["note"] = "正文已迁移至考点 API（points/）"
                elif ent.get("kind") == "index":
                    ent["note"] = "建议从「考点（API）」按章浏览"
    meta = data.setdefault("meta", {})
    meta["migratedAt"] = "2026-09-26"
    meta["primaryCatalog"] = "api-ref"
    INDEX.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print({"migrated": migrated, "skipped": skipped, "points": len(items)})


if __name__ == "__main__":
    main()
