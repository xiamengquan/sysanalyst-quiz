#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
M1 一次性：按案例相关性标签裁剪 content/kb-index.json 与 content/kb/ 正文文件。
- api-ref：删除 case=none 的考点条目及其 md 文件
- essay：整节删除（论文范文）
- quick：删除论文向 / 上午卷向速查
- part1：删除 ch01/02/03/04/06（绪论、数学、计算机系统、网络、企业信息化）
- part3：删除 ch22（论文写作要点）
"""
import json
import os
import subprocess

ROOT = "/Users/workflow/Workspace/sysanalyst-quiz"
INDEX = f"{ROOT}/content/kb-index.json"

QUICK_DELETE = {
    "差错控制 · 计算速查",
    "前端友好 · 数学白话卡",
    "前端友好 · 网络英文缩写卡",
    "前端友好 · HTTP缓存对照卡",
    "速查 · 企业架构 · TOGAF 与 Zachman · 论文素材卡",
    "需求侧论文写作框架",
    "论文热点方向写作框架（2026）",
    "论文方向写作索引",
    "近五年论文范围分析",
}
PART1_DELETE = {"ch01", "ch02", "ch03", "ch04", "ch06"}
PART3_DELETE = {"ch22"}

kb = json.load(open(INDEX, encoding="utf-8"))

to_delete = []   # content 相对路径
for s in kb["sections"]:
    if s["id"] == "api-ref":
        keep, drop = [], []
        for it in s["items"]:
            if it.get("case") == "none":
                drop.append(it)
            else:
                keep.append(it)
        s["items"] = keep
        for it in drop:
            to_delete.append("content/kb/" + it["path"])
    elif s["id"] == "essay":
        for it in s["items"]:
            to_delete.append("content/kb/" + it["path"])
        s["items"] = []
        s["_removed"] = "论文范文：下午二卷退出站点范围（2026-10-19 决策）"
    elif s["id"] == "quick":
        keep = []
        for it in s["items"]:
            if it["title"] in QUICK_DELETE:
                to_delete.append("content/kb/" + it["path"])
            else:
                keep.append(it)
        s["items"] = keep
    elif s["id"] == "part1":
        keep = []
        for it in s["items"]:
            if it["id"] in PART1_DELETE:
                to_delete.append("content/kb/" + it["path"])
            else:
                keep.append(it)
        s["items"] = keep
    elif s["id"] == "part3":
        keep = []
        for it in s["items"]:
            if it["id"] in PART3_DELETE:
                to_delete.append("content/kb/" + it["path"])
            else:
                keep.append(it)
        s["items"] = keep

json.dump(kb, open(INDEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# 顺带清理 points/ 下未被索引引用的孤儿变体文件（*-2.md 等旧草稿）
referenced = set()
for s in kb["sections"]:
    for it in s.get("items", []):
        referenced.add(os.path.normpath("content/kb/" + it["path"]))
points_dir = f"{ROOT}/content/kb/points"
for fn in os.listdir(points_dir):
    p = os.path.normpath(f"content/kb/points/{fn}")
    if p not in referenced and fn.endswith(".md"):
        to_delete.append(p)

to_delete = sorted(set(to_delete))
if to_delete:
    subprocess.run(["git", "-C", ROOT, "rm", "-rq", *to_delete], check=True)
print(f"pruned index + removed {len(to_delete)} files")
kept_points = len(kb["sections"][0]["items"]) if kb["sections"][0]["id"] == "api-ref" else "?"
print("api-ref kept:", kept_points)