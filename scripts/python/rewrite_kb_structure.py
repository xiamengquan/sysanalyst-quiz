#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""知识点结构式重写（模板 v2）：对 content/kb/points/kp-*.md 做确定性结构归一。

规则见 docs/kb-workshop/编制委员会/知识点结构式模板-v2.md。
输出：改写统计 + 残留问题清单（需内容级手工修复的，如残缺表格）。
"""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POINTS = ROOT / "content/kb/points"

PLACE_SENT = re.compile(r"[。；]?\s*\*{0,2}作用\*{0,2}[：:]\s*用于题干场景下的概念识别、对比选型与案例/论文回扣[。；]?")
PLACE_MIX = re.compile(r"与同章相邻考点区分[；;]?\s*")
PLACE_KW_LINE = re.compile(r"^（?检索关键词[:：].*）?$")
PLACE_ARCH_LINE = re.compile(r"^（?本节与相邻考点易混点见归档篇章.*）?$")
OLD_H2_NUM = re.compile(r"^## ([一二三四五六七八九十]+)、\s*(.*)$")
OLD_H3_NUM = re.compile(r"^### (\d+(?:\.\d+)*|[一二三四五六七八九十]+)、?\s*(.*)$")
STATUS_RE = re.compile(r"工坊精修 v[\d.]+")

MANUAL_FIX: list[dict] = []
STATS: Counter = Counter()


def split_sections(lines: list[str]) -> tuple[int, list[dict]]:
    """返回 (首个H1索引, [{level, title, start(含标题行), end(不含)}])，H3 不切节。"""
    h1_idx = next((i for i, l in enumerate(lines) if re.match(r"^# [^#]", l)), -1)
    secs: list[dict] = []
    for i, l in enumerate(lines):
        m2 = re.match(r"^## (.+)$", l)
        if m2:
            if secs:
                secs[-1]["end"] = i
            secs.append({"level": 2, "title": m2.group(1).strip(), "start": i, "end": len(lines)})
    if secs:
        secs[-1]["end"] = len(lines)
    return h1_idx, secs


def body_text(lines: list[str], start: int, end: int) -> str:
    """节正文（不含标题行），压缩后便于比较。"""
    parts = []
    for l in lines[start + 1 : end]:
        s = l.strip()
        if not s or s == "---" or s.startswith(">"):
            continue
        parts.append(s.replace("**", "").replace("·", ""))
    return "".join(parts)


def main() -> None:
    files = sorted(POINTS.glob("kp-*.md"))
    changed = 0
    for path in files:
        orig = path.read_text(encoding="utf-8")
        lines = orig.splitlines()
        stats: Counter = Counter()
        out = transform(lines, stats, path.name)
        text = "\n".join(out).rstrip("\n") + "\n"
        # 收敛多余空行
        text = re.sub(r"\n{3,}", "\n\n", text)
        if text != orig:
            path.write_text(text, encoding="utf-8")
            changed += 1
        for k, v in stats.items():
            STATS[k] += v
    print({"files": len(files), "changed": changed})
    print("处理统计:", dict(STATS.most_common()))
    if MANUAL_FIX:
        out = ROOT / "docs/kb-workshop/审计委员会/意见" / f"结构重写-残留手工项-{date.today().isoformat()}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(MANUAL_FIX, ensure_ascii=False, indent=2), encoding="utf-8")
        print("需手工修复:", len(MANUAL_FIX), "→", out.relative_to(ROOT))
    else:
        print("需手工修复: 0")


def transform(lines: list[str], stats: Counter, fname: str) -> list[str]:
    # ---------- 1) 删除第二个及以后的 H1（旧整章头）及其紧随引用/分隔线 ----------
    first_h1 = next((i for i, l in enumerate(lines) if re.match(r"^# [^#]", l)), -1)
    drop = set()
    for i, l in enumerate(lines):
        if i <= first_h1:
            continue
        if re.match(r"^# [^#]", l):
            drop.add(i)
            stats["删旧章H1"] += 1
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines) and lines[j].strip().startswith("> 出自"):
                drop.add(j)
                j += 1
                while j < len(lines) and not lines[j].strip():
                    j += 1
                if j < len(lines) and lines[j].strip() == "---":
                    drop.add(j)
    lines = [l for i, l in enumerate(lines) if i not in drop]

    # ---------- 2) 行级占位清理 ----------
    cleaned = []
    for l in lines:
        s = l.strip()
        if PLACE_KW_LINE.match(s) or PLACE_ARCH_LINE.match(s):
            stats["删占位行"] += 1
            continue
        new = PLACE_SENT.sub("。", l)
        if new != l:
            stats["删万能作用句"] += 1
        new2 = PLACE_MIX.sub("", new)
        if new2 != new:
            stats["删别搞混占位"] += 1
        cleaned.append(new2)
    lines = cleaned

    # ---------- 3) 状态行 ----------
    lines = [
        STATUS_RE.sub("结构式重写 v2.0", l) if STATUS_RE.search(l) else l for l in lines
    ]

    # ---------- 4) 节级处理 ----------
    for _pass in range(3):
        lines = section_pass(lines, stats, fname)

    # ---------- 5) 旧编号小节清理（### 一、 / ### 2.1） ----------
    out = []
    for l in lines:
        m = OLD_H3_NUM.match(l)
        if m:
            title = m.group(2).strip()
            out.append(f"### {title}")
            stats["去旧编号"] += 1
        else:
            out.append(l)
    lines = out

    # ---------- 6) 重复行去重（≥20字，含表格行） ----------
    seen: set[str] = set()
    out = []
    for l in lines:
        s = l.strip()
        if s.startswith("#") or not s or s == "---" or s.startswith(">"):
            out.append(l)
            continue
        if len(s) >= 20:
            if s in seen:
                stats["删重复行"] += 1
                continue
            seen.add(s)
        out.append(l)
    lines = out

    # ---------- 7) 重复 ### 小节标题去重（同 H2 节内） ----------
    lines = dedup_h3_in_section(lines, stats)

    # ---------- 8) 残缺表格：表头后缺分隔行则补 ----------
    lines = fix_table_separator(lines, stats, fname)

    return lines


def section_pass(lines: list[str], stats: Counter, fname: str) -> list[str]:
    _, secs = split_sections(lines)
    if not secs:
        return lines
    drop: set[int] = set()
    insert_after: dict[int, list[str]] = {}

    def sec_body(start: int, end: int) -> str:
        return body_text(lines, start, end)

    # 找 概述 / 要点 / 应试 / 易混辨析
    ov = next((s for s in secs if s["title"].startswith("概述")), None)
    yd = next((s for s in secs if s["title"].startswith("要点")), None)
    ys = next((s for s in secs if s["title"].startswith("应试")), None)

    for s in secs:
        t = s["title"]
        base = re.sub(r"^[一二三四五六七八九十]+、\s*", "", t)
        # ---- 本章考什么 ----
        if base == "本章考什么":
            if ov and ov["start"] < s["start"]:
                ov_body = sec_body(ov["start"], ov["end"])
                cur = sec_body(s["start"], s["end"])
                if cur and cur in ov_body:
                    for i in range(s["start"], s["end"]):
                        drop.add(i)
                    stats["删重复本章考什么"] += 1
                else:
                    # 并入概述
                    blk = lines[s["start"] + 1 : s["end"]]
                    insert_after.setdefault(ov["end"] - 1, []).extend(blk)
                    for i in range(s["start"], s["end"]):
                        drop.add(i)
                    stats["并入概述"] += 1
            else:
                lines[s["start"]] = "## 概述"
                stats["改名概述"] += 1
        # ---- 核心知识点/概念 等旧壳 H2：删壳留内容 ----
        elif base == "核心知识点/概念" or (OLD_H2_NUM.match(t) and "考什么" not in base and (yd and s["start"] > yd["start"])):
            if "易混对比" in base or "易混辨析" in base:
                lines[s["start"]] = "## 易混辨析"
                stats["改易混辨析"] += 1
            else:
                for i in range(s["start"], s["start"] + 1):
                    drop.add(i)
                stats["删旧章壳H2"] += 1
        # ---- 易混对比 → 易混辨析 ----
        elif t == "易混对比":
            lines[s["start"]] = "## 易混辨析"
            stats["改易混辨析"] += 1
        # ---- 空壳步骤节 ----
        elif t.startswith("步骤与流程"):
            body = sec_body(s["start"], s["end"])
            if "未单独列出固定步骤名" in body and "###" not in "".join(
                lines[s["start"] + 1 : s["end"]]
            ):
                for i in range(s["start"], s["end"]):
                    drop.add(i)
                stats["删空壳步骤节"] += 1
        # ---- 常考数字/结论/口诀 → 应试下小节 ----
        elif t.startswith("常考数字") or t.startswith("常考结论"):
            blk = [f"### {t}"] + lines[s["start"] + 1 : s["end"]]
            for i in range(s["start"], s["end"]):
                drop.add(i)
            if ys and ys["start"] > s["start"]:
                insert_after.setdefault(ys["start"], []).extend(blk)
            else:
                insert_after.setdefault(s["end"] - 1 if s["end"] - 1 > s["start"] else s["start"], []).extend(blk)
            stats["移动常考结论"] += 1

    # 占位易混辨析删除（正文仅含占位）
    _, secs2 = split_sections(lines)
    yh = [s for s in secs2 if s["title"].startswith("易混辨析")]
    real = [s for s in yh if sec_body(s["start"], s["end"])]
    if len(yh) > 1:
        for s in yh:
            if s not in real:
                for i in range(s["start"], s["end"]):
                    drop.add(i)
                stats["删占位易混辨析"] += 1
            elif len(real) > 1 and s is not real[0]:
                # 合并到第一个实义辨析
                blk = lines[s["start"] + 1 : s["end"]]
                insert_after.setdefault(real[0]["end"] - 1, []).extend(blk)
                for i in range(s["start"], s["end"]):
                    drop.add(i)
                stats["合并易混辨析"] += 1

    out = []
    for i, l in enumerate(lines):
        if i in drop:
            continue
        out.append(l)
        if i in insert_after:
            out.extend([""] + insert_after[i])
    return out


def dedup_h3_in_section(lines: list[str], stats: Counter) -> list[str]:
    out = []
    seen: set[str] = set()
    for l in lines:
        if l.startswith("## "):
            seen = set()
        m = re.match(r"^### (.+)$", l)
        if m:
            t = m.group(1).strip()
            if t in seen:
                stats["删重复小节标题"] += 1
                continue
            seen.add(t)
        out.append(l)
    return out


def fix_table_separator(lines: list[str], stats: Counter, fname: str) -> list[str]:
    out = list(lines)
    i = 0
    while i < len(out):
        if out[i].strip().startswith("|") and i + 1 < len(out):
            nxt = out[i + 1].strip()
            if nxt and not nxt.startswith("|") and not nxt.startswith("#") and not nxt.startswith(">"):
                cols = out[i].strip().strip("|").count("|") + 1
                sep = "|" + "---|" * cols
                out.insert(i + 1, sep)
                stats["补表分隔行"] += 1
                i += 2
                continue
        i += 1
    # 列数不齐检测（仅报告）
    j = 0
    while j < len(out):
        if out[j].strip().startswith("|"):
            k = j
            block = []
            while k < len(out) and out[k].strip().startswith("|"):
                block.append(k)
                k += 1
            counts = [out[x].strip().strip("|").count("|") + 1 for x in block]
            if len(set(counts)) > 1:
                MANUAL_FIX.append({"file": fname, "line": block[0] + 1, "cols": counts,
                                   "block": [out[x].strip()[:60] for x in block[:6]]})
            j = k
        else:
            j += 1
    return out


if __name__ == "__main__":
    main()