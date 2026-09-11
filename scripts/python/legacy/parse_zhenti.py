#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Parse Soft Exam 真题 PDFs (already extracted text) into structured MCQs + index."""
from __future__ import annotations
import json, re, hashlib
from pathlib import Path
from collections import defaultdict

ROOT = Path("/Users/workflow/Documents/系统分析师知识点精炼")
RAW = ROOT / "题库/真题/_raw_text"
OUT = ROOT / "题库/真题"
WEB = ROOT / "题库/答题网页"
PDF_DIR = ROOT / "真题资料"

def md5(*a):
    return hashlib.md5("||".join(map(str, a)).encode()).hexdigest()[:10]

def norm_space(s: str) -> str:
    s = s.replace("\u3000", " ").replace("\xa0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()

def parse_options_block(block: str) -> dict | None:
    """Extract A/B/C/D options from a blank-number block."""
    # Patterns like: A.xxx B.yyy or A．xxx
    opts = {}
    # unify fullwidth dots
    b = block.replace("．", ".").replace("、", ".")
    # try inline: A. ... B. ... C. ... D. ...
    m = re.search(
        r"A\.\s*(.*?)\s*B\.\s*(.*?)\s*C\.\s*(.*?)\s*D\.\s*(.*?)(?:\n|$)",
        b, re.S,
    )
    if m:
        opts = {k: norm_space(m.group(i)) for i, k in enumerate("ABCD", 1)}
        # trim trailing analysis
        for k in opts:
            opts[k] = re.split(r"(试题分析|参考答案)", opts[k])[0].strip()
        if all(opts.values()):
            return opts
    # line-wise
    for k in "ABCD":
        mm = re.search(rf"(?:^|\n)\s*{k}\.\s*(.+?)(?=(?:\n\s*[A-D]\.)|\n\s*试题分析|\n\s*参考答案|\Z)", b, re.S)
        if mm:
            opts[k] = norm_space(mm.group(1))
    if len(opts) == 4:
        return opts
    return None

def extract_answers_map(text: str) -> dict[int, str]:
    """Parse 参考答案：（1）A （2）B or 参考答案：A"""
    ans = {}
    for m in re.finditer(r"参考答案[：:]\s*(.+?)(?:\n\s*[●•]|\n\s*非学员|\Z)", text, re.S):
        chunk = m.group(1)
        for mm in re.finditer(r"[（(](\d{1,2})[）)]\s*([A-Da-d])", chunk):
            ans[int(mm.group(1))] = mm.group(2).upper()
        # single
        if not re.search(r"[（(]\d+[）)]", chunk):
            mm = re.search(r"\b([A-Da-d])\b", chunk)
            # handled per-question below
    # also global patterns like 故（88）选C
    for mm in re.finditer(r"[（(](\d{1,2})[）)]\s*选\s*([A-D])", text):
        ans[int(mm.group(1))] = mm.group(2)
    for mm in re.finditer(r"参考答案[：:]\s*[（(](\d{1,2})[）)]\s*([A-D])", text):
        ans[int(mm.group(1))] = mm.group(2)
    # multi on one line
    for mm in re.finditer(r"参考答案[：:]([^\n]+)", text):
        for x in re.finditer(r"[（(](\d{1,2})[）)]\s*([A-D])", mm.group(1)):
            ans[int(x.group(1))] = x.group(2)
    return ans

def split_bullet_items(text: str) -> list[str]:
    # split on ● or •
    parts = re.split(r"\n\s*[●•]\s*", "\n" + text)
    return [p.strip() for p in parts if p.strip() and len(p.strip()) > 20]

def parse_bullet_paper(text: str, source: str, year: str, half: str) -> list[dict]:
    items = split_bullet_items(text)
    answers_global = extract_answers_map(text)
    out = []
    for item in items:
        # skip headers
        if "请按下述要求" in item[:80] or "答题卡" in item[:40] and "（" not in item[:100]:
            continue
        # find blank numbers in stem
        blanks = re.findall(r"[（(](\d{1,2})[）)]", item)
        if not blanks:
            continue
        # analysis / answer separation
        body, analysis = item, ""
        if "试题分析" in item:
            body, analysis = item.split("试题分析", 1)
            analysis = "试题分析" + analysis
        # per-blank options: look for （n） A. B. C. D.
        for bn in blanks:
            n = int(bn)
            # option block after （n）
            om = re.search(
                rf"[（(]{n}[）)]\s*(.*?)(?=[（(]\d{{1,2}}[）)]|试题分析|参考答案|\Z)",
                body, re.S,
            )
            opt_text = om.group(1) if om else ""
            # if options not right after blank, try whole body after first blank mention
            opts = parse_options_block(opt_text) or parse_options_block(body)
            if not opts:
                continue
            # stem: from start to options of this blank; simplify — use text before first A.
            stem_src = body
            # remove option lines for cleaner stem? keep with blank
            stem = re.split(r"\n\s*A[\.．]", stem_src, maxsplit=1)[0]
            stem = norm_space(stem)
            stem = re.sub(r"\s+", " ", stem)
            if len(stem) < 8:
                continue
            # answer
            ans = answers_global.get(n)
            if not ans:
                m = re.search(rf"[（(]{n}[）)]\s*([A-D])", analysis)
                if m:
                    ans = m.group(1)
                else:
                    m = re.search(rf"参考答案[：:]\s*[（(]{n}[）)]\s*([A-D])", analysis)
                    if m:
                        ans = m.group(1)
                    else:
                        # single blank item
                        m = re.search(r"参考答案[：:]\s*([A-D])", analysis)
                        if m and len(set(blanks)) == 1:
                            ans = m.group(1)
            if not ans:
                continue
            # explain trim
            exp = ""
            if analysis:
                exp = re.split(r"参考答案", analysis, 1)[0]
                exp = norm_space(exp.replace("试题分析", "")).strip()
                if len(exp) > 400:
                    exp = exp[:400] + "…"
            # skip exam-date trivia mostly? keep them, user can filter
            out.append({
                "id": f"ZT-{year}{half}-{n}-{md5(stem, ans)}",
                "source": source,
                "year": year,
                "half": half,
                "kind": "上午",
                "qnum": n,
                "stem": stem if f"（{n}）" in stem or f"({n})" in stem else stem + f"（{n}）",
                "opts": opts,
                "ans": ans,
                "exp": exp,
                "diff": "real",
            })
    # dedupe by qnum within paper keep first good
    by_n = {}
    for q in out:
        by_n.setdefault(q["qnum"], q)
    return list(by_n.values())

def parse_numbered_2025(text: str, source: str) -> list[dict]:
    """2025 recall MCQ: 1. stem A B C D 答案：X"""
    out = []
    # split by numbered questions
    parts = re.split(r"\n\s*(\d{1,3})[\.、．]\s*", text)
    # parts: [preamble, num, body, num, body, ...]
    i = 1
    while i + 1 < len(parts):
        num = int(parts[i])
        body = parts[i + 1]
        i += 2
        if num > 90:  # soft exam morning typically <=75; 2025 machine exam may differ
            pass
        ans_m = re.search(r"(?:参考)?答案\s*[：:]\s*([A-D])", body)
        if not ans_m:
            continue
        ans = ans_m.group(1)
        before = body[:ans_m.start()]
        opts = parse_options_block(before)
        if not opts:
            continue
        stem = re.split(r"\n\s*A[\.．]", before, maxsplit=1)[0]
        stem = norm_space(stem)
        if len(stem) < 6:
            continue
        exp = body[ans_m.end():]
        exp = norm_space(re.sub(r"^(试题分析|解析)[：:]?", "", exp))[:400]
        out.append({
            "id": f"ZT-2025下-{num}-{md5(stem, ans)}",
            "source": source,
            "year": "2025",
            "half": "下",
            "kind": "上午",
            "qnum": num,
            "stem": stem,
            "opts": opts,
            "ans": ans,
            "exp": exp,
            "diff": "real",
        })
    return out

def parse_gaopin(text: str, source: str) -> list[dict]:
    """高频错题100题 — often numbered with 请作答此空"""
    out = []
    parts = re.split(r"\n\s*(\d{1,3})[\.、．]\s*", text)
    i = 1
    while i + 1 < len(parts):
        num = int(parts[i])
        body = parts[i + 1]
        i += 2
        if num > 120:
            continue
        # answers may be like 参考答案：A  or 答案 A
        ans_m = re.search(r"(?:参考)?答案\s*[：:：]?\s*([A-D])", body)
        # sometimes two blanks
        answers = re.findall(r"(?:参考)?答案[^A-D]{0,6}([A-D])", body[:800])
        opts = parse_options_block(body)
        if not opts:
            continue
        stem = re.split(r"\n\s*A[\.、．]", body, maxsplit=1)[0]
        stem = norm_space(stem)
        if len(stem) < 8:
            continue
        ans = ans_m.group(1) if ans_m else (answers[0] if answers else None)
        if not ans:
            # try 故选A
            m = re.search(r"选\s*([A-D])", body)
            if m:
                ans = m.group(1)
        if not ans:
            continue
        exp = ""
        if "试题分析" in body:
            exp = norm_space(body.split("试题分析", 1)[1])[:400]
        out.append({
            "id": f"ZT-高频-{num}-{md5(stem, ans)}",
            "source": source,
            "year": "专项",
            "half": "",
            "kind": "高频错题",
            "qnum": num,
            "stem": stem,
            "opts": opts,
            "ans": ans,
            "exp": exp,
            "diff": "real",
        })
    return out

def main():
    catalog = json.loads((OUT / "catalog.json").read_text(encoding="utf-8"))
    # fix 2025 MCQ misclassification
    for c in catalog:
        if c["file"] == "1a089085d33_46e.pdf":
            c["kind"] = "上午"
            c["subject"] = "综合知识"
            c["label"] = "2025年下半年上午-综合知识"
        if c["duplicate_of"]:
            continue
    (OUT / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

    all_q = []
    stats = []
    seen_files = set()
    for c in catalog:
        if c.get("duplicate_of"):
            continue
        tf = OUT / c["text_file"]
        if not tf.exists():
            continue
        text = tf.read_text(encoding="utf-8")
        year, half, kind = c["year"], c["half"], c["kind"]
        src = c["label"]
        qs = []
        if c["file"] == "1a089085d33_46e.pdf" or (year == "2025" and kind == "上午"):
            qs = parse_numbered_2025(text, src)
        elif kind == "专项" or "高频" in c["subject"]:
            qs = parse_gaopin(text, src)
        elif kind == "上午":
            qs = parse_bullet_paper(text, src, year, half)
        else:
            continue
        for q in qs:
            q["paper"] = c["file"]
        all_q.extend(qs)
        stats.append((src, len(qs)))
        print(f"{src}: {len(qs)}")

    # dedupe by stem+ans
    uniq = {}
    for q in all_q:
        key = re.sub(r"\s+", "", q["stem"])[:120] + q["ans"]
        if key not in uniq:
            uniq[key] = q
    questions = list(uniq.values())
    questions.sort(key=lambda x: (x["year"], x["half"], x["kind"], x["qnum"]))
    for i, q in enumerate(questions, 1):
        q["no"] = i

    (OUT / "上午真题.jsonl").write_text(
        "\n".join(json.dumps(q, ensure_ascii=False) for q in questions) + "\n", encoding="utf-8"
    )

    # markdown index
    lines = [
        "# 系统分析师 · 真题资料索引",
        "",
        "> 来源：你提供的本地 PDF（51CTO 学习资料）。**仅供个人学习**，请勿外传。",
        "",
        "## PDF 清单（已去重）",
        "",
        "| 标签 | 页数 | 原文件 | 状态 |",
        "|------|------|--------|------|",
    ]
    for c in catalog:
        st = f"重复→{c['duplicate_of']}" if c.get("duplicate_of") else "主文件"
        lines.append(f"| {c['label']} | {c['pages']} | `{c['file']}` | {st} |")
    lines += [
        "",
        f"## 已解析上午/专项选择题",
        "",
        f"**可刷题数量：{len(questions)}**（写入 `上午真题.jsonl`，已接入答题页「真题」题库）",
        "",
        "| 试卷 | 解析题数 |",
        "|------|----------|",
    ]
    for s, n in stats:
        lines.append(f"| {s} | {n} |")
    lines += [
        "",
        "## 案例 / 论文",
        "",
        "下午案例与论文保留原文抽取在 `_raw_text/`，建议直接对照 PDF 练习；答题页以选择题为主。",
        "",
        "## 使用",
        "",
        "1. 打开答题页，题库选「真题」或「全部」。",
        "2. 连续通关可按年份顺序刷完解析出的选择题。",
        "",
    ]
    (OUT / "00-真题索引.md").write_text("\n".join(lines), encoding="utf-8")

    # merge into web questions: practice + real
    practice_path = ROOT / "题库/综合知识/all.jsonl"
    practice = []
    if practice_path.exists():
        for line in practice_path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                o = json.loads(line)
                practice.append({
                    "no": o["no"],
                    "ch": o.get("chapter", 0),
                    "point": o.get("point", ""),
                    "stem": o["stem"],
                    "opts": o["options"],
                    "ans": o["answer"],
                    "exp": o.get("explain", ""),
                    "diff": o.get("difficulty", "basic"),
                    "bank": "practice",
                    "source": "自编练习",
                    "year": "",
                })

    real_web = []
    for q in questions:
        real_web.append({
            "no": 100000 + q["no"],  # separate numbering in UI we show source
            "ch": 99,
            "point": f"{q['year']}{q['half']+'半年' if q['half'] else ''}·第{q['qnum']}题",
            "stem": q["stem"],
            "opts": q["opts"],
            "ans": q["ans"],
            "exp": q.get("exp") or q.get("source", ""),
            "diff": "real",
            "bank": "real",
            "source": q["source"],
            "year": str(q["year"]),
            "qnum": q["qnum"],
        })

    combined = practice + real_web
    WEB.mkdir(parents=True, exist_ok=True)
    (WEB / "questions.js").write_text(
        "window.QUESTIONS = " + json.dumps(combined, ensure_ascii=False) + ";\n"
        + "window.QUESTION_META = " + json.dumps({
            "practice": len(practice),
            "real": len(real_web),
            "total": len(combined),
        }, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print("TOTAL real", len(questions), "practice", len(practice), "web", len(combined))

if __name__ == "__main__":
    main()
