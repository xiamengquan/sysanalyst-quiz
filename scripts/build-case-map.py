#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
M1 一次性统计：从 197 道案例真题提取「出题区 × 考点 × 问法」分布。
产物：
  public/data/case-map.json          —— 机器可读案例考点地图（供出题区地图页使用）
  docs/web-team/内容/案例分析考点地图-2026-10.md  —— 人工可读统计报告
说明：cases.json / case-packs.json 在 M1 删除后本脚本不可再运行，数据以 git 历史为准。
"""
import json
import collections
import datetime

ROOT = "/Users/workflow/Workspace/sysanalyst-quiz"
cases = json.load(open(f"{ROOT}/public/data/cases.json"))

def counter_to_sorted(d, n=99):
    return [{"key": k, "count": v} for k, v in sorted(d.items(), key=lambda x: -x[1])[:n]]

# ===== 总量 =====
total_q = sum(len(c["questions"]) for c in cases)
banks = collections.Counter(c.get("bank", "") for c in cases)
years_real = collections.Counter(c["year"] for c in cases if c.get("bank") == "real" and c.get("year"))

# ===== 出题区（domain）维度 =====
domains = {}
for c in cases:
    d = c["domain"]
    e = domains.setdefault(d, {
        "count": 0, "chapters": set(), "years": collections.Counter(),
        "caseTypes": collections.Counter(), "answerTypes": collections.Counter(),
        "points": collections.Counter(), "questionCount": 0,
    })
    e["count"] += 1
    e["chapters"].add(c["chapter"])
    if c.get("year"):
        e["years"][c["year"]] += 1
    e["caseTypes"][c["case_type"]] += 1
    e["questionCount"] += len(c["questions"])
    for q in c["questions"]:
        e["answerTypes"][q.get("answer_type", "?")] += 1
    e["points"][c["point"]] += 1

domain_list = []
for d, e in sorted(domains.items(), key=lambda x: -x[1]["count"]):
    domain_list.append({
        "domain": d,
        "caseCount": e["count"],
        "questionCount": e["questionCount"],
        "chapters": sorted(e["chapters"]),
        "years": dict(sorted(e["years"].items())),
        "caseTypes": counter_to_sorted(e["caseTypes"]),
        "answerTypes": counter_to_sorted(e["answerTypes"]),
        "points": counter_to_sorted(e["points"]),
    })

case_types = collections.Counter(c["case_type"] for c in cases)
answer_types = collections.Counter(q.get("answer_type", "?") for c in cases for q in c["questions"])
points = collections.Counter(c["point"] for c in cases)

case_map = {
    "meta": {
        "generatedAt": datetime.date.today().isoformat(),
        "source": "cases.json（197 道案例真题，2014–2026 真题 + 自编案例；数据文件已按 2026-10-19 决策删除，git 历史可查）",
        "totalCases": len(cases),
        "totalQuestions": total_q,
        "banks": dict(banks),
        "realYearCoverage": dict(sorted(years_real.items())),
        "note": "本地图为 M1 蒸馏产物：真题题干与解析不留站，命题规律以统计形式沉淀于此。",
    },
    "caseTypes": counter_to_sorted(case_types),
    "answerTypes": counter_to_sorted(answer_types),
    "points": counter_to_sorted(points, n=99),
    "domains": domain_list,
}

with open(f"{ROOT}/public/data/case-map.json", "w", encoding="utf-8") as f:
    json.dump(case_map, f, ensure_ascii=False)

# ===== Markdown 报告 =====
lines = []
a = lines.append
a("# 案例分析考点地图 · 统计报告（2026-10）")
a("")
a("> 产物背景：2026-10-19 决策——站点只服务「下午一 · 案例分析」，真题不留站（实练移交外部站点），")
a("> 非案例内容彻底删除。本报告是从 197 道案例真题中蒸馏出的命题规律，作为后续「出题区地图」页面与")
a("> 考点「案例三件套」改写的唯一统计依据。源数据 cases.json / case-packs.json 已删除，git 历史可查。")
a("")
a("## 一、总量与结构")
a("")
a(f"- 案例真题总数：**{len(cases)} 道**（含 {banks.get('real', 0)} 道真题回忆整理 + {banks.get('case', 0)} 道自编案例），共 {total_q} 个问句")
a(f"- 真题年份覆盖：{('、'.join(f'{k}（{v}）' for k, v in sorted(years_real.items())))}")
a(f"- 题型分布（case_type）：{'；'.join(f'{k} {v}' for k, v in case_types.most_common())}")
a(f"- 问法分布（answer_type）：{'；'.join(f'{k} {v}' for k, v in answer_types.most_common())}（design=方案设计，short=简答，compare=对比）")
a("")
a("## 二、出题区分布（按案例数降序）")
a("")
a("| 出题区 | 案例数 | 问句数 | 年份分布 | 高频题型 |")
a("|---|---|---|---|---|")
for d in domain_list:
    ystr = "、".join(f"{y}×{n}" for y, n in sorted(d["years"].items())) or "—"
    tstr = "、".join(f"{t['key']} {t['count']}" for t in d["caseTypes"][:2])
    a(f"| {d['domain']} | {d['caseCount']} | {d['questionCount']} | {ystr} | {tstr} |")
a("")
a("## 三、高频出题点（point，前 30）")
a("")
a("| 出题点 | 次数 |")
a("|---|---|")
for p in points.most_common(30):
    a(f"| {p[0]} | {p[1]} |")
a("")
a("## 四、对体系建设的含义（M2/M3 输入）")
a("")
a("1. **出题区不只有 5 条专题路径**：Web / 需求 / 数据库 / 移动 / 微服务 / 嵌入式 / 集成 / 大数据 / CPS / 架构 / 测试 / 安全 / 运维均有真题落地；「移动」「嵌入式」「大数据」「集成」尚未建专题路径，M3 需补齐。")
a("2. **题型三巨头**：技术方案论证（70）、建模与设计（67）、问题诊断与改进（54）——答题模板与步骤链应按这三类套路组织，而非按知识点平铺。")
a("3. **问法可枚举**：compare（141）/ design（261）/ short（184）——每考点「怎么考」字段应标注该考点最常落入的问法。")
a("4. **删除数据的恢复通道**：全部源数据在 git 历史（快照 commit）中，题目正文的最终处置遵循「不留站」决策。")
a("")
open(f"{ROOT}/docs/web-team/内容/案例分析考点地图-2026-10.md", "w", encoding="utf-8").write("\n".join(lines) + "\n")

print("case-map.json domains:", len(domain_list), "| total cases:", len(cases), "| questions:", total_q)
print("points:", len(points))