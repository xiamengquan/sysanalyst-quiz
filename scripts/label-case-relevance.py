#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
M1 一次性：给 174 篇考点打案例相关性标签（写入 content/kb-index.json）。
规则依据 docs/web-team/内容/案例分析考点地图-2026-10.md 的出题区分布：
  core    —— 该考点分组直接对应案例出题区（有真题落地）
  related —— 案例答题的支撑基础（间接相关，保留）
  none    —— 案例分析不考（M1 彻底删除）
标签字段：case: core|related|none；caseDomains: 出题区列表；caseFreq: 对应案例数。
"""
import json

ROOT = "/Users/workflow/Workspace/sysanalyst-quiz"
INDEX = f"{ROOT}/content/kb-index.json"

# 分组前缀 → (label, domains, freq, 说明)
MAP = {
    "科目1 · 1.":  ("none", [], None, "计算机系统：上午卷范围，案例不单独出题"),
    "科目1 · 2.":  ("none", [], None, "计算机网络：上午卷范围"),
    "科目1 · 3.":  ("core", ["数据库"], 19, "数据库出题区"),
    "科目1 · 4.":  ("none", [], None, "企业信息化：上午卷范围"),
    "科目1 · 5.":  ("related", ["建模与设计", "需求"], None, "软件工程基础：需求/建模答题的支撑"),
    "科目1 · 6.":  ("core", ["项目管理"], 1, "项目管理：案例低频出现"),
    "科目1 · 7.":  ("core", ["安全"], 6, "安全出题区"),
    "科目1 · 8.":  ("core", ["系统规划"], 2, "系统规划出题区"),
    "科目1 · 9.":  ("core", ["需求"], 28, "需求出题区（第二大出题区）"),
    "科目1 · 10.": ("core", ["架构", "集成"], 20, "架构出题区 + 应用系统集成"),
    "科目1 · 11.": ("core", ["建模与设计"], 67, "建模与设计为案例第一题型载体"),
    "科目1 · 12.": ("core", ["测试"], 7, "测试出题区"),
    "科目1 · 13.": ("core", ["运维"], 6, "运维出题区"),
    "科目1 · 14.": ("none", [], None, "开源软件：案例不考"),
    "科目1 · 15.": ("none", [], None, "标准化与知识产权：上午卷范围"),
    "科目1 · 16.": ("none", [], None, "经济管理：上午卷范围"),
    "科目1 · 17.": ("none", [], None, "数学与工程基础：上午卷范围"),
    "科目1 · 18.": ("none", [], None, "专业英语：上午卷范围"),
    "科目2 · 1.":  ("core", ["Web"], 39, "Web 出题区（第一大出题区）"),
    "科目2 · 2.":  ("core", ["嵌入式"], 16, "嵌入式出题区"),
    "科目2 · 3.":  ("core", ["移动"], 16, "移动应用出题区"),
    "科目2 · 4.":  ("core", ["大数据"], 11, "大数据出题区"),
    "科目2 · 5.":  ("core", ["微服务"], 16, "微服务出题区"),
    "科目2 · 6.":  ("core", ["CPS"], 10, "信息物理系统出题区"),
    "科目3 · 1.":  ("core", ["综合案例"], None, "案例教材主线章节"),
    "科目3 · 2.":  ("core", ["数据库"], None, "数据库建模（案例教材）"),
    "科目3 · 3.":  ("related", ["网络规划"], None, "网络规划：案例间接相关"),
    "科目3 · 4.":  ("core", ["安全"], None, "系统安全性分析（案例教材）"),
    "科目3 · 5.":  ("core", ["集成"], None, "应用系统集成出题区"),
    "科目3 · 6.":  ("related", ["集成", "需求"], None, "企业信息系统：集成/需求间接相关"),
    "科目3 · 7.":  ("related", ["综合案例"], None, "开源软件：案例间接相关"),
    "科目3 · 8.":  ("core", ["微服务", "大数据"], None, "新技术及其应用（微服务/大数据/AI 落地）"),
    "科目3 · 论文写作方法": ("none", [], None, "论文写作：下午二卷整体退出站点范围"),
}

kb = json.load(open(INDEX, encoding="utf-8"))
stats = {"core": 0, "related": 0, "none": 0}
unmapped = []
for s in kb["sections"]:
    if s["id"] != "api-ref":
        continue
    for it in s["items"]:
        g = it.get("group", "")
        hit = None
        for prefix, (label, domains, freq, note) in MAP.items():
            if g.startswith(prefix):
                hit = (label, domains, freq, note)
                break
        if hit is None:
            unmapped.append((it["id"], g))
            continue
        label, domains, freq, note = hit
        it["case"] = label
        it["caseDomains"] = domains
        if freq is not None:
            it["caseFreq"] = freq
        it["caseNote"] = note
        stats[label] += 1

json.dump(kb, open(INDEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("labels:", stats)
print("unmapped:", unmapped)