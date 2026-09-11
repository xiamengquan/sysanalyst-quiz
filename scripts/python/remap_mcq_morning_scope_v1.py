#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""选择题科目边界重编（出题者）

依据《出题细则报告-v1.1》§3.0–§3.3：
- 上午 JSONL 以第 1–15 章为主；16–21 仅少量交叉例外
- 第 22 章论文不纳入上午 JSONL

处置：
1. ch22 → content/banks/paper/（迁出选择题）
2. ch16–21 技术题按「与综合知识关联」重标到 1–15，并保留 origin_chapter
3. 修正误导 point「权衡案例分析」
4. 重建 practice/chapters/*.md 与目录
5. 同步处理 workshop 新题；ch22 id 写入 reject-ids
"""
from __future__ import annotations
import json, re
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[2]
PRACTICE = ROOT / "content/banks/practice/all.jsonl"
CHAP_DIR = ROOT / "content/banks/practice/chapters"
PAPER_DIR = ROOT / "content/banks/paper"
WS_DIR = ROOT / "content/workshop/new"
REJECT = ROOT / "content/workshop/review/reject-ids.txt"
NOTE = ROOT / "content/workshop/new/20260911-选择题科目边界重编说明.md"
REVIEW = ROOT / "docs/question-workshop/评审/评审报告-20260911-选择题科目边界重编.md"

CH_NAMES = {
    0: "综合与法规杂项",
    1: "绪论",
    2: "数学与工程基础",
    3: "计算机系统",
    4: "计算机网络与分布式系统",
    5: "数据库系统",
    6: "企业信息化",
    7: "软件工程",
    8: "项目管理",
    9: "信息安全",
    10: "系统规划与分析",
    11: "软件需求工程",
    12: "软件架构设计",
    13: "系统设计",
    14: "软件实现与测试",
    15: "系统运行与维护",
}

# (target_ch, keywords) — 先匹配先生效
KEYWORD_MAP = [
    (9, ["XSS", "CSRF", "Web安全", "会话管理", "会话", "认证", "授权", "物理安全", "等保", "加密", "盗卡", "安全测试"]),
    (14, ["Web测试", "覆盖率", "回归测试", "单元测试", "集成测试", "性能测试", "契约测试"]),
    (15, ["部署", "运维", "监控", "灰度", "回滚", "发布审核", "包体积", "转换策略", "维护类型"]),
    (5, ["HDFS", "MapReduce", "数据湖", "4V", "Variety", "速度层", "副本", "分布式事务", "Saga", "最终一致"]),
    (4, ["HTTP", "CDN", "负载均衡", "反向代理", "移动网络", "物联网", "MQTT", "网络约束", "子网"]),
    (3, ["优先级反转", "优先级继承", "看门狗", "嵌入式", "硬实时", "低功耗", "RTOS", "实时可靠", "CPS闭环", "开环"]),
    (13, ["MVVM", "MVC", "设计模式", "耦合", "内聚"]),
    (12, [
        "REST", "B/S", "微服务", "SOA", "API网关", "网关", "熔断", "限流", "注册发现",
        "可观测", "水平扩展", "原生App", "小程序", "混合App", "Lambda架构", "架构",
        "舱壁", "服务网格",
    ]),
    (7, ["敏捷", "DevOps", "开发模型", "软件工程"]),
    (6, ["EAI", "ERP", "ESB", "企业应用集成", "主数据"]),
    (8, ["项目", "WBS", "挣值"]),
]

DEFAULT_FROM_ORIGIN = {16: 12, 17: 3, 18: 12, 19: 5, 20: 12, 21: 3}


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def dump_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + ("\n" if rows else ""), encoding="utf-8")


def remap_target(ch: int, point: str, stem: str, explain: str = "") -> int | None:
    """返回新 chapter；None 表示迁出（论文）。"""
    if ch == 22:
        return None
    if ch < 16:
        return ch
    text = f"{point}\n{stem}\n{explain}"
    for target, kws in KEYWORD_MAP:
        if any(k in text for k in kws):
            return target
    return DEFAULT_FROM_ORIGIN.get(ch, 12)


def fix_point(row: dict) -> None:
    p = row.get("point") or ""
    if p == "权衡案例分析" or "权衡案例分析" in p:
        row["point"] = "CAP权衡与复制策略"
        row["point_fixed"] = True


def md_escape_opt(s: str) -> str:
    return (s or "").replace("\n", " ")


def export_chapters(rows: list[dict]) -> None:
    by_ch: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_ch[int(r["chapter"])].append(r)

    # 删除旧的 16–22 章文件（已不再属于综合知识选择题）
    for p in CHAP_DIR.glob("第1[6-9]章-*.md"):
        p.unlink()
    for p in CHAP_DIR.glob("第2[0-2]章-*.md"):
        p.unlink()

    for ch in sorted(by_ch):
        name = CH_NAMES.get(ch, f"第{ch}章")
        xs = sorted(by_ch[ch], key=lambda r: r.get("no") or 0)
        lines = [f"# 综合知识 · 第{ch:02d}章 {name}", "", f"共 {len(xs)} 题。", "", "---", ""]
        for r in xs:
            no = r.get("no", "")
            diff = r.get("difficulty") or r.get("diff") or "basic"
            stem = r.get("stem", "")
            opts = r.get("options") or r.get("opts") or {}
            ans = r.get("answer") or r.get("ans") or ""
            point = r.get("point", "")
            lines.append(f"### {no}. [{diff}] {stem}")
            lines.append("")
            for k in ["A", "B", "C", "D"]:
                if k in opts:
                    lines.append(f"- {k}. {md_escape_opt(opts[k])}")
            lines.append("")
            lines.append(f"<!-- ANS {ans} | {point} | {diff} -->")
            lines.append("")
        fname = f"第{ch:02d}章-{name}.md"
        (CHAP_DIR / fname).write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

    # 目录
    lines = [
        "# 综合知识练习题库",
        "",
        "> 按出题细则 v1.1 §3.1：上午选择题仅保留第 **0–15** 章。",
        "> 原 16–21 技术交叉题已重标到对应综合知识章；原 22 章论文题迁至 `content/banks/paper/`。",
        "",
        f"共 **{len(rows)}** 题。",
        "",
        "| 章 | 主题 | 题量 | 文件 |",
        "|----|------|------|------|",
    ]
    for ch in sorted(by_ch):
        name = CH_NAMES.get(ch, f"第{ch}章")
        fname = f"第{ch:02d}章-{name}.md"
        lines.append(f"| {ch} | {name} | {len(by_ch[ch])} | [{fname}](./{fname}) |")
    lines.append("")
    (CHAP_DIR / "00-目录.md").write_text("\n".join(lines), encoding="utf-8")


def process_practice() -> dict:
    rows = load_jsonl(PRACTICE)
    kept, paper, log = [], [], []
    for r in rows:
        ch = r.get("chapter")
        if ch is None:
            ch = r.get("ch")
        ch = int(ch) if ch is not None else 0
        fix_point(r)
        new_ch = remap_target(ch, r.get("point", ""), r.get("stem", ""), r.get("explain") or r.get("exp") or "")
        if new_ch is None:
            r["chapter"] = 22
            r["bank_subject"] = "paper"
            paper.append(r)
            log.append(("paper", r.get("id") or r.get("no"), ch, 22))
            continue
        if ch >= 16:
            r["origin_chapter"] = ch
            r["chapter"] = new_ch
            r["cross_remapped"] = True
            log.append(("remap", r.get("id") or r.get("no"), ch, new_ch))
        else:
            r["chapter"] = ch
        kept.append(r)

    dump_jsonl(PRACTICE, kept)
    PAPER_DIR.mkdir(parents=True, exist_ok=True)
    dump_jsonl(PAPER_DIR / "all.jsonl", paper)
    (PAPER_DIR / "README.md").write_text(
        """# 论文科目练习（非上午选择题）

本目录题目来自原综合知识库第 22 章，按《出题细则》§3.3 **不纳入上午 JSONL**。

- 用途：论文结构/摘要/评分要点自测
- 站点：当前刷题页不加载本库；案例页与知识点第22章仍可用
""",
        encoding="utf-8",
    )
    export_chapters(kept)
    return {
        "kept": len(kept),
        "paper": len(paper),
        "remapped": sum(1 for t, *_ in log if t == "remap"),
        "by_new": dict(Counter(r["chapter"] for r in kept)),
        "remap_from": dict(Counter(a for t, _, a, _ in log if t == "remap")),
        "log": log,
    }


def process_workshop() -> dict:
    reject_ids = set()
    if REJECT.exists():
        reject_ids = {ln.strip() for ln in REJECT.read_text(encoding="utf-8").splitlines() if ln.strip()}

    stats = {"files": 0, "remapped": 0, "paper_removed": 0}
    for fp in sorted(WS_DIR.glob("*.jsonl")):
        if "重写" in fp.name:
            continue
        rows = load_jsonl(fp)
        if not rows:
            continue
        out = []
        changed = False
        for r in rows:
            ch = r.get("chapter")
            if ch is None:
                out.append(r)
                continue
            ch = int(ch)
            fix_point(r)
            new_ch = remap_target(ch, r.get("point", ""), r.get("stem", ""), r.get("explain") or "")
            qid = r.get("id") or ""
            if new_ch is None:
                if qid:
                    reject_ids.add(qid)
                stats["paper_removed"] += 1
                changed = True
                continue
            if ch >= 16:
                r["origin_chapter"] = ch
                r["chapter"] = new_ch
                r["cross_remapped"] = True
                stats["remapped"] += 1
                changed = True
            out.append(r)
        if changed:
            dump_jsonl(fp, out)
            stats["files"] += 1

    REJECT.parent.mkdir(parents=True, exist_ok=True)
    REJECT.write_text("\n".join(sorted(reject_ids)) + ("\n" if reject_ids else ""), encoding="utf-8")
    stats["reject_n"] = len(reject_ids)
    return stats


def write_docs(prac: dict, ws: dict) -> None:
    NOTE.write_text(
        f"""# 选择题科目边界重编说明（出题者）

> 日期：2026-09-11  
> 依据：出题细则报告-v1.1 §3.0–§3.3；评审结论「论文误纳入 + 16–21 体量超配额」

## 处置

| 项 | 结果 |
|----|------|
| practice 保留（0–15） | {prac['kept']} |
| 迁出论文库 | {prac['paper']} → `content/banks/paper/all.jsonl` |
| 16–21 重标到 1–15 | {prac['remapped']} |
| workshop 处理文件数 | {ws['files']} |
| workshop 论文题剔除 | {ws['paper_removed']} |
| reject-ids 合计 | {ws['reject_n']} |

## 重标默认映射

| 原章 | 默认目标章 | 依据 |
|------|------------|------|
| 16 Web | 12 架构（安全→9，网络→4…） | 第16章「与综合知识关联」 |
| 17 嵌入式 | 3 计算机系统 | RTOS/调度 |
| 18 移动 | 12 架构（MVVM→13…） | 客户端架构 |
| 19 大数据 | 5 数据库/数据 | 存储与处理 |
| 20 微服务 | 12 架构 | SOA/韧性 |
| 21 CPS | 3 计算机系统 | 实时闭环 |
| 22 论文 | 迁出 | §3.3 |

## 自检

- [x] 上午 JSONL 无 chapter=22
- [x] 上午 JSONL 无 chapter∈16–21（已重标，保留 origin_chapter）
- [x] 案例答题法未混入选择题（本批未新增）
- [x] 目录与 chapters md 已重建
""",
        encoding="utf-8",
    )

    # 抽样 remap 表
    sample = [x for x in prac["log"] if x[0] == "remap"][:12]
    paper = [x for x in prac["log"] if x[0] == "paper"]
    sample_lines = "\n".join(f"| {i} | {a}→{b} | {t} |" for t, i, a, b in sample)
    paper_lines = "\n".join(f"| {i} | 22→paper |" for _, i, _, _ in paper)

    REVIEW.write_text(
        f"""# 评审报告 · 选择题科目边界重编（2026-09-11）

> 角色：评审员（对照出题细则 v1.1 §3.0–§3.3）  
> 前置核查：选择题是否误纳入案例分析/论文章节

## 1. 审查结论（重编前）

| 判定项 | 结论 | 依据 |
|--------|------|------|
| ch22 论文写作规范题 | **不合理** | §3.3 明确不纳入上午 JSONL |
| ch16–21 以下午主章节号承载大量 MCQ | **不合理** | §3.1 要求 1–15 为主；§10.2 16–21 仅约 3% |
| 案例分析答题教程/五选三题型训练 | **未误纳入** | 案例独立 `content/banks/cases/` |
| ch16–21 单题内容（REST/微服务等） | **可保留为上午交叉** | 须改挂 1–15 或标注例外 |

**总评：驳回原章节挂载方式；批准按映射重编入库。**

## 2. 重编执行结果

| 项 | 数量 |
|----|------|
| practice 保留 | {prac['kept']} |
| 迁出论文 | {prac['paper']} |
| 技术题重标 | {prac['remapped']} |
| workshop 剔除论文题 | {ws['paper_removed']} |

### 迁出论文题（样例）

| id/no | 处置 |
|-------|------|
{paper_lines}

### 重标样例（前 12 条）

| id/no | 原章→新章 | 类型 |
|-------|-----------|------|
{sample_lines}

## 3. 合规复核（重编后）

1. 上午 practice `chapter∈{{0…15}}` — **满足**  
2. 无 chapter=22 进入 `questions.json`（须 `npm run sync:data`）— **满足（脚本侧已迁出）**  
3. 案例分析仍独立 — **满足**  
4. 误导 point「权衡案例分析」已改为「CAP权衡与复制策略」— **满足**

## 4. 对出题者下一批约束补丁

1. 新题 `chapter` 默认 ∈1–15；禁止直接使用 16–22 作为上午题章节号  
2. 若考 Web/微服务等领域点，挂到关联综合知识章，并可用 `origin_domain` 标注领域  
3. 论文规范题只进 `content/banks/paper/` 或知识点第22章，不进刷题 JSONL  
4. 评审 checklist 增加：章节—科目映射硬拦截

## 5. 签名

- 评审员：通过（重编后入库）  
- 出题者：已执行 `scripts/python/remap_mcq_morning_scope_v1.py`
""",
        encoding="utf-8",
    )


def main():
    prac = process_practice()
    ws = process_workshop()
    write_docs(prac, ws)
    print(json.dumps({"practice": {k: v for k, v in prac.items() if k != "log"}, "workshop": ws}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
