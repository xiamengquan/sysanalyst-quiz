#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Full audit of practice bank (all.jsonl) against 出题细则报告 rules."""
from __future__ import annotations
import json, re
from pathlib import Path
from collections import Counter, defaultdict

REPO = Path(__file__).resolve().parents[2]
PRACTICE = REPO / "content/banks/practice/all.jsonl"
REVIEW = REPO / "content/workshop/review"
RULES = REPO / "docs/question-workshop"
BANK = PRACTICE
OUT = REVIEW
OUT.mkdir(parents=True, exist_ok=True)

TEMPLATE_STEM = re.compile(
    r"^(关于.+?[，,].*?(说法正确|正确的是|正确理解)|下列与「.+?」相关|在系统分析师考试范围内|"
    r"在信息化项目中提到|下列选项中，符合.+?定义|【练习】关于)"
)
TEMPLATE_EXP = re.compile(r"正确项阐述了|考点：.+。$|考点：.+\。?\s*$")
BAD_DISTRACTOR = re.compile(r"与.+无关|以上说法均不正确|与该概念无关|无关的描述")

def load():
    return [json.loads(l) for l in BANK.read_text(encoding="utf-8").splitlines() if l.strip()]

def audit_one(q: dict, point_ans_count: dict) -> list[str]:
    reasons = []
    stem = q.get("stem", "")
    exp = q.get("explain", "") or ""
    opts = q.get("options") or {}
    ans = q.get("answer", "")
    point = q.get("point", "")
    diff = q.get("difficulty", "basic")

    if TEMPLATE_STEM.search(stem) or ("下列说法正确的是" in stem and len(stem) < 40):
        reasons.append("模板题干(§9.5/§7避免模板化)")
    if len(stem) < 25 and diff != "basic":
        reasons.append("题干过短与难度不匹配(§6)")
    if len(stem) < 18:
        reasons.append("题干过短(§4机考短题下限仍需可解)")

    if not exp or len(exp) < 35:
        reasons.append("解析不足35字(§7解析质量)")
    if TEMPLATE_EXP.search(exp) or exp.strip() in (f"考点：{point}。", f"考点：{point}"):
        reasons.append("模板解析(§9.6)")

    # distractors
    bad_d = 0
    for k, v in opts.items():
        if BAD_DISTRACTOR.search(str(v)):
            bad_d += 1
    if bad_d:
        reasons.append(f"无效干扰项x{bad_d}(§5.3)")

    # option length absurd
    for k, v in opts.items():
        if len(str(v)) > 80:
            reasons.append("选项过长(§5.1)")
            break

    if ans not in opts:
        reasons.append("答案字母无效")
    elif not all(k in opts for k in "ABCD"):
        reasons.append("选项不全")

    key = (q.get("chapter"), point, opts.get(ans, ""))
    if point_ans_count.get(key, 0) > 1:
        reasons.append("同考点同正确项重复(§9.10)")

    # deep tagged but looks like definition-only template
    if diff == "deep" and TEMPLATE_STEM.search(stem) and len(stem) < 50:
        reasons.append("深度标注与题型不符(§6)")

    # no scenario/calc for deep expected - soft
    if diff == "deep" and not re.search(r"某|若|计算|等于|约为|应选择|最|不", stem):
        if len(stem) < 60:
            reasons.append("深度题缺少情景/计算/对比(§6)")

    return reasons

def main():
    qs = load()
    # count point+correct
    pac = Counter()
    for q in qs:
        opts = q.get("options") or {}
        ans = q.get("answer", "")
        pac[(q.get("chapter"), q.get("point"), opts.get(ans, ""))] += 1

    results = []
    for q in qs:
        reasons = audit_one(q, pac)
        verdict = "驳回" if reasons else "通过"
        results.append({
            "no": q["no"],
            "id": q.get("id", f"CK-{q['no']}"),
            "chapter": q.get("chapter"),
            "point": q.get("point"),
            "difficulty": q.get("difficulty"),
            "stem": q["stem"],
            "options": q["options"],
            "answer": q["answer"],
            "explain": q.get("explain", ""),
            "verdict": verdict,
            "reasons": reasons,
        })

    rejected = [r for r in results if r["verdict"] == "驳回"]
    passed = [r for r in results if r["verdict"] == "通过"]

    # write machine audit
    (OUT / "自编全量机审-20260910.jsonl").write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in results) + "\n", encoding="utf-8"
    )
    # rewrite queue for setter: only needed fields + reasons
    queue = []
    for r in rejected:
        queue.append({
            "replace_no": r["no"],
            "id": r["id"],
            "chapter": r["chapter"],
            "point": r["point"],
            "difficulty": r["difficulty"] if r["difficulty"] in ("basic", "medium", "deep") else "basic",
            "old_stem": r["stem"],
            "old_answer_text": r["options"].get(r["answer"], ""),
            "reasons": r["reasons"],
            "rewrite_brief": (
                f"重写第{r['no']}题，考点「{r['point']}」(第{r['chapter']}章)。"
                f"原难度{r['difficulty']}。驳回原因：{'；'.join(r['reasons'])}。"
                f"要求：原创题干（禁用「关于…下列说法正确的是」模板）；"
                f"解析>30字且说明错项；干扰项用相邻概念；可保留同一正确知识点但换设问。"
            ),
        })
    (OUT / "打回重写队列-20260910.jsonl").write_text(
        "\n".join(json.dumps(x, ensure_ascii=False) for x in queue) + "\n", encoding="utf-8"
    )
    (OUT / "reject-ids-自编全量.txt").write_text(
        "\n".join(str(r["no"]) for r in rejected) + "\n", encoding="utf-8"
    )
    (OUT / "pass-ids-自编全量.txt").write_text(
        "\n".join(str(r["no"]) for r in passed) + "\n", encoding="utf-8"
    )

    reason_c = Counter()
    for r in rejected:
        for x in r["reasons"]:
            # normalize
            reason_c[re.sub(r"x\d+", "xN", x.split("(")[0])] += 1

    by_ch = Counter(r["chapter"] for r in rejected)
    summary = {
        "total": len(qs),
        "pass": len(passed),
        "reject": len(rejected),
        "pass_rate": round(len(passed) / len(qs) * 100, 1),
        "top_reasons": reason_c.most_common(12),
        "reject_by_chapter": dict(sorted(by_ch.items())),
    }
    (OUT / "自编全量机审摘要-20260910.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
