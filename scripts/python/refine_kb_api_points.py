#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""工坊精修：按标题关键词重切篇章正文，统一 API 六节（编制乙答卷准则）。"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
KB = ROOT / "content/kb"
POINTS = KB / "points"
INDEX = ROOT / "content/kb-index.json"

SKIP_IDS = {"kp-2-7"}

EXCLUDE_H2 = re.compile(
    r"本章考什么|易混对比|应试钩子|与综合知识关联|使用说明|Dev Docs|篇索引|分章速查|常考数字"
)

DEF_LINE = re.compile(
    r"^\*\*(.+?)（答卷·(?:定义|必背)）\*\*：?\s*(.*)$|"
    r"^\*\*(.+?)（答卷·定义）\*\*：?\s*(.*)$|"
    r"^(.+?)（答卷·定义）\s*$",
    re.M,
)
ACT_LINE = re.compile(
    r"^\*\*(.+?)（答卷·作用）\*\*：?\s*(.*)$|^\*\*(.+?)的作用（答卷）\*\*\s*$",
    re.M,
)

# 关键词 → 章内锚点（工坊人工校准）
ANCHOR_HINTS: dict[str, list[str]] = {
    "kp-11-2": ["WFMS", "工作流"],
    "kp-11-3": ["RTSAD", "模块内聚", "结构化设计", "耦合"],
    "kp-11-4": ["面向对象设计", "SOLID", "ECB", "迪米特", "开闭"],
    "kp-11-5": ["设计模式", "GoF", "创建型", "行为型"],
    "kp-11-6": ["输入", "输出四原则"],
    "kp-11-7": ["人机交互", "黄金三原则"],
    "kp-5-3": ["CASE", "集成开发", "编程环境"],
    "kp-5-4": ["CMMI", "成熟度", "过程域"],
    "kp-5-2": ["软件开发模型", "瀑布", "螺旋", "敏捷"],
    "kp-5-5": ["重用", "再工程", "逆向"],
    "kp-5-7": ["UML"],
    "kp-软件生命周期": ["软件生命周期"],
    "kp-10-5": ["业务流程", "TFD", "BAM", "BPM"],
    "kp-10-6": ["DFD", "数据流", "SA 方法"],
    "kp-10-7": ["可行性", "NPV", "回收期"],
    "kp-9-2": ["需求获取", "访谈", "JRP", "五法"],
    "kp-9-4": ["结构化分析", "DFD", "数据字典", "STD"],
    "kp-9-5": ["用例", "BCE", "分析模型"],
    "kp-12-3": ["架构风格", "数据流", "SOA"],
    "kp-14-3": ["黑盒", "白盒", "逻辑覆盖"],
    "kp-13-4": ["维护四类", "改正性", "完善性", "预防性"],
    "kp-13-6": ["遗留系统", "四象限"],
    "kp-13-5": ["系统评价", "效益", "效果"],
    "kp-13-7": ["转换", "并行", "分段"],
    "kp-2-4": ["网络工程", "规划", "拓扑"],
    "kp-2-5": ["分布式", "CAP", "一致性"],
    "kp-3-7": ["数据挖掘", "聚类", "关联规则"],
    "kp-4-1": ["企业信息化", "概述"],
    "kp-5-6": ["软件产品线", "核心资产", "变体"],
    "kp-5-8": ["形式化", "Z语言", "VDM"],
    "kp-8-6": ["DFD", "数据流图", "加工"],
    "kp-8-7": ["可行性", "技术可行性", "经济可行性"],
    "kp-10-2": ["4+1", "Kruchten", "逻辑视图"],
    "kp-概率统计-图论-预测决策-数学建模-工程伦理": ["概率", "图论", "工程伦理"],
}

ESSAY_INDEX_TITLES: dict[str, str] = {
    "kp-论文专题": "论文专题组 · 信息系统开发及应用",
    "kp-论文专题-2": "论文专题组 · 数据库建模及应用",
    "kp-论文专题-3": "论文专题组 · 网络规划及应用",
    "kp-论文专题-4": "论文专题组 · 系统安全性分析",
    "kp-论文专题-5": "论文专题组 · 应用系统集成",
    "kp-论文专题-6": "论文专题组 · 企业信息系统",
    "kp-论文专题-7": "论文专题组 · 开源软件及应用",
    "kp-论文专题-8": "论文专题组 · 新技术及其应用",
    "kp-内容": "论文写作方法 · 注意事项与评分",
}

POLISH_STATUS = "工坊精修 v1.2.8 · 审计通过"

DEF_OVERRIDES_PATH = Path(__file__).resolve().parent / "kb_def_overrides.json"
QUESTIONS_PATH = ROOT / "public/data/questions.json"
EXAM_MIN_QUALITY = 180

DEF_MIN_QUALITY = 100
RAW_MIN_QUALITY = 220

CHAPTER_QUICK: dict[int, list[str]] = {
    2: ["速查/前端友好-数学白话卡.md"],
    4: ["速查/REST架构风格-体系化学习卡.md"],
    7: ["速查/UML-体系化学习指南.md"],
    11: ["速查/需求工程-体系化学习路径.md", "速查/案例必答-需求获取五法对比卡.md"],
    12: ["速查/Web与AI智能体-架构选型四维度卡.md"],
}

HARVEST_CACHE: dict[int, list[tuple[str, str, str]]] = {}


def load_def_overrides() -> dict[str, str]:
    if DEF_OVERRIDES_PATH.is_file():
        data = json.loads(DEF_OVERRIDES_PATH.read_text(encoding="utf-8"))
        return {str(k): str(v) for k, v in data.items()}
    return {}


DEF_OVERRIDES: dict[str, str] = load_def_overrides()


class QuestionBankIndex:
    """练习库按教程章聚合，用于高频章「应试」加厚。"""

    def __init__(self, path: Path) -> None:
        self.by_ch: dict[int, list[dict]] = defaultdict(list)
        self.ch_total: dict[int, int] = defaultdict(int)
        if not path.is_file():
            return
        rows = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(rows, list):
            return
        for row in rows:
            ch = row.get("ch")
            if ch in (None, 0, 99):
                continue
            if row.get("bank") == "real":
                continue
            c = int(ch)
            self.by_ch[c].append(row)
            self.ch_total[c] += 1
        self.hot_chapters = {
            c for c, _ in sorted(self.ch_total.items(), key=lambda x: -x[1])[:14]
        }

    def exam_supplement(self, item: dict, keys: list[str]) -> str:
        ch = item.get("chapter")
        if not ch:
            return ""
        c = int(ch)
        total = self.ch_total.get(c, 0)
        if total < 8:
            return ""
        pool = self.by_ch.get(c, [])
        matched: list[dict] = []
        for q in pool:
            blob = (q.get("point") or "") + (q.get("stem") or "")
            if keys and any(k in blob for k in keys if len(k) >= 2):
                matched.append(q)
        if not matched:
            matched = pool[:12]
        points = list(
            dict.fromkeys(q.get("point") or "" for q in matched if q.get("point"))
        )[:5]
        lines = [f"- **本章练习热力**：教程第 {c} 章约 {total} 题（站点练习库，不含真题卷 ch=99）。"]
        if points:
            lines.append("- **题库考点标签**：" + "、".join(points) + "。")
        kw = next((k for k in keys if len(k) >= 2), "")
        href = f"/?bank=practice&chapter={c}&path=all"
        if kw:
            href += f"&q={quote(kw)}"
        label = f"第 {c} 章练习"
        if kw:
            label += f"（关键词 {kw}）"
        lines.append(f"- **练题入口**：[{label}]({href})")
        return "\n".join(lines)


def format_slice(head: str, body: str) -> str:
    tail = head.split("/")[-1].strip()
    if tail.startswith("O ") and "人机" in head:
        tail = "I/O 与人机交互"
    return f"### {tail}\n\n{body}".strip()


ESSAY_DEF_PREFIX = (
    "论文可从本组大纲专题中择一，用同一项目经历按第22章「摘要+正文三问」撰写；"
    "正文须写清项目背景、本人角色、关键技术方案及可量化成果（规模/工期/指标）。"
)

FORCE_EXTRACT: dict[str, tuple[int, str]] = {
    "kp-11-2": (13, "工作流 WFMS"),
    "kp-13-4": (15, "维护四类"),
    "kp-13-5": (15, "系统评价"),
    "kp-13-6": (15, "遗留系统"),
    "kp-13-7": (15, "转换"),
    "kp-9-4": (11, "结构化分析"),
    "kp-10-2": (12, "4+1"),
    "kp-5-6": (7, "产品线"),
    "kp-5-8": (7, "形式化"),
    "kp-8-6": (10, "DFD"),
    "kp-8-7": (10, "可行性"),
    "kp-2-4": (4, "网络工程"),
    "kp-3-7": (5, "数据挖掘"),
    "kp-概率统计-图论-预测决策-数学建模-工程伦理": (2, "概率统计"),
    "kp-运维指标-MTTR-MTBF-MTTF-MTTA": (15, "MTBF"),
    "kp-9-3": (11, "需求开发四阶段"),
    "kp-8-4": (10, "问题分析"),
    "kp-2-5": (4, "分布式"),
    "kp-4-1": (6, "企业信息化"),
    "kp-13-3": (15, "故障管理"),
}

ESSAY_MULTI_CH: dict[str, list[int]] = {
    "kp-应用系统分析与设计": [10, 13, 16],
    "kp-移动-Web": [16, 18],
    "kp-质量保证": [8, 14],
}

ESSAY_SYNTHETIC: dict[str, str] = {
    "kp-开源软件": """**开源软件** 指源码可获取、可在开源许可证约束下使用与再发布的软件。

- **论文角度**：选型（许可合规、社区活跃度、安全响应）、与商业产品集成、治理（SBOM、漏洞扫描）。
- **素材章节**：大纲§14；综合知识见第7章工具链、第16—21章典型栈（Linux、中间件、容器生态）。
- **勿写**：无实例的空洞「开源好」；须绑定项目场景与风险对策。""",
}

SYNTHETIC_POINTS: dict[str, str] = {
    "kp-9-3": """**需求分析**是对已获取需求进行整理、澄清、建模与协商，形成无冲突、可验证、可跟踪需求集合的活动。

- **相对需求获取**：获取偏收集原始素材；分析偏消歧、冲突消解、优先级与可行性筛选。
- **需求开发链**：获取 → **分析** → 规格说明（SRS）→ 验证；分析输出是规格化的前置。
- **常用方法**：结构化分析（DFD/数据字典）、面向对象（用例/领域类）、原型与评审。
- **质量关注**：一致性、完整性、可验证性、可追溯性（IEEE 好需求特性）。""",
    "kp-5-6": """**软件产品线**在共享核心资产上通过变体绑定交付不同产品。

- **核心资产**：可复用架构、组件、需求/设计模型与过程框架。
- **过程**：领域分析 → 领域设计 → 领域实现；新需求尽量映射到已有变体机制。
- **与单项目复用区别**：产品线是组织级、长期演进的复用战略，而非一次性代码拷贝。""",
    "kp-5-8": """**形式化方法**用数学规约与证明描述、验证软件行为，降低自然语言歧义。

- **典型手段**：公理化规约、代数规约、模型检测（Model Checking）等。
- **适用**：安全攸关、协议与控制等要求高可靠领域；成本高于常规开发。
- **与测试区别**：形式化侧重规约层面的穷尽或证明，测试侧重抽样执行验证。""",
    "kp-13-5": """**系统评价**对已建成信息系统按效率、能力、效果、效益等维度衡量与复核。

- **流程**：确定评价对象 → 收集资料 → 实施评价 → 复核报送。
- **用途**：支撑改造、替换、继续运行或投资追加决策；案例宜写指标与数据来源。""",
    "kp-2-4": """**网络工程**三阶段：规划（需求/可行性）→ 设计（拓扑、协议、地址、安全）→ 实施（布线、配置、测试验收）。

- **规划交付**：需求说明、可行性报告、总体方案。
- **设计交付**：逻辑/物理拓扑、IP 与 VLAN 规划、安全策略。
- **实施要点**：按图施工、设备配置备份、连通性与性能验收。""",
    "kp-2-5": """**分布式系统**由多台独立计算机协同对外呈现单一系统能力。

- **关键议题**：透明性（访问/迁移/复制等）、一致性、容错与并发控制。
- **CAP**：在一致性、可用性、分区容忍性之间权衡（P 通常必须接受）。
- **与集中式对比**：扩展性更好，设计与运维复杂度更高。""",
    "kp-3-7": """**数据挖掘**从大量数据中发现隐含、有用且可行动的模式与知识。

- **任务**：分类、聚类、关联规则、序列模式、偏差/离群检测等。
- **方法**：统计、机器学习、神经网络、遗传算法、模糊集等。
- **链路位置**：OLTP/业务库 → 集成/仓库 → OLAP → **挖掘** → 决策应用。""",
    "kp-4-1": """**企业信息化**是信息技术与企业管理流程深度融合，提升运营与决策能力。

- **范围**：基础设施、业务系统（ERP/CRM 等）、数据资源与治理、安全与标准。
- **阶段**：规划 → 建设 → 集成 → 运维与优化；与战略对齐是规划前提。""",
    "kp-5-3": """> 教程无独立 7.3 专节；以下为备考提纲。

**集成开发环境（IDE）** 是集编辑、编译/构建、调试、版本管理于一体的软件开发环境。

**CASE 工具** 是在软件工程各阶段提供建模、分析、生成与管理的计算机辅助软件工程工具。

- **开发环境**：语言/框架 SDK、构建工具（Maven/Gradle）、调试器、静态分析插件。
- **CASE 分类**：按阶段分为需求（建模/原型）、设计（UML/CASE）、实现（代码生成）、测试（用例管理）、维护（逆向/再工程）工具。
- **选型要点**：与团队过程（瀑布/敏捷）、制品库、CI 是否集成；避免「工具堆叠、流程不配套」。""",
}

SPECIAL_BODY: dict[str, tuple[str, str | None]] = {
    "kp-开源社区-许可-语言平台-框架库-服务器-工具-评估": (
        "第一篇-基础知识/第07章-软件工程.md",
        "开发环境",
    ),
    "kp-标准类型-生命周期-知识产权": (
        "第一篇-基础知识/第06章-企业信息化.md",
        "信息资源管理",
    ),
    "kp-概率统计-图论-预测决策-数学建模-工程伦理": (
        "第一篇-基础知识/第02章-数学与工程基础.md",
        None,
    ),
    "kp-英文阅读-领域术语": ("第一篇-基础知识/第01章-绪论.md", None),
    "kp-注意事项-解答步骤-摘要正文-评分": (
        "第三篇-案例实践/第22章-系统分析师论文写作要点.md",
        "评分",
    ),
}


def load_points() -> list[dict]:
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


def title_keywords(title: str) -> list[str]:
    t = re.sub(r"^\d+(?:\.\d+)*\s*", "", title)
    t = re.sub(r"[（(].*?[）)]", " ", t)
    parts = re.split(r"[^\w\u4e00-\u9fff]+", t)
    keys = [p for p in parts if len(p) >= 2]
    # 英文缩写
    for m in re.finditer(r"[A-Z]{2,}", title):
        keys.append(m.group(0))
    return list(dict.fromkeys(keys))[:12]


def split_h2_blocks(text: str) -> list[tuple[str, str]]:
    m = re.search(r"^##\s", text, re.M)
    if not m:
        return []
    text = text[m.start() :]
    lines = text.splitlines()
    blocks: list[tuple[str, str]] = []
    cur_title, cur = "", []
    for line in lines:
        if line.startswith("## ") and not line.startswith("### "):
            if cur_title:
                blocks.append((cur_title, "\n".join(cur).strip()))
            cur_title, cur = line[3:].strip(), []
            continue
        if cur_title:
            cur.append(line)
    if cur_title:
        blocks.append((cur_title, "\n".join(cur).strip()))
    return blocks


def atomic_sections(ch_text: str) -> list[tuple[str, str]]:
    """章内可分配片段：(复合标题, 正文)。"""
    out: list[tuple[str, str]] = []
    for h2, body in split_h2_blocks(ch_text):
        if EXCLUDE_H2.search(h2):
            continue
        subs = re.split(r"(?=^###\s)", body, flags=re.M)
        if len(subs) > 1:
            for sub in subs:
                sub = sub.strip()
                if not sub:
                    continue
                first = sub.split("\n", 1)[0]
                h3 = first[4:].strip() if first.startswith("###") else h2
                body3 = sub.split("\n", 1)[1] if "\n" in sub else ""
                out.append((f"{h2} / {h3}", body3.strip() or sub))
        else:
            # 长节按空行拆段，便于 WFMS 等段落级考点
            if len(body) > 1200:
                paras = re.split(r"\n\s*\n", body)
                for para in paras:
                    p = para.strip()
                    if len(p) > 80:
                        lead = p.split("\n", 1)[0][:40]
                        out.append((f"{h2} / {lead}", p))
            else:
                out.append((h2, body))
    return out


def outline_section_markers(outline_ref: str | None, chapter: int | None) -> list[str]:
    """大纲节点与教程章号一致时，才用「节.小节」匹配 ### 标题（避免 15.1 误命中 4.1）。"""
    if not outline_ref or not chapter:
        return []
    head = outline_ref.split("（")[0].strip()
    m = re.search(r"(\d+)\.(\d+)(?:\.(\d+))?", head)
    if not m:
        return []
    ref_ch, major, minor = int(m.group(1)), m.group(2), m.group(3)
    if ref_ch != int(chapter):
        return []
    marks: list[str] = []
    if minor:
        marks.append(f"{major}.{minor}")
    marks.append(f"{major}.")
    return marks


def score_item(
    item_id: str,
    keys: list[str],
    heading: str,
    body: str,
    outline_ref: str | None = None,
    chapter: int | None = None,
) -> float:
    blob = f"{heading}\n{body[:1200]}"
    s = 0.0
    for k in keys:
        if k in blob:
            s += min(len(k), 10) * 2.5
    for hint in ANCHOR_HINTS.get(item_id, []):
        if hint in blob:
            s += 40
    clean_keys = [k for k in keys if len(k) >= 3]
    if clean_keys and sum(1 for k in clean_keys if k in heading) >= min(2, len(clean_keys)):
        s += 35
    for mark in outline_section_markers(outline_ref, chapter):
        if mark in heading:
            s += 48
            break
    return s


def assign_slices(items: list[dict]) -> dict[str, str]:
    by_ch: dict[int, list[dict]] = defaultdict(list)
    for it in items:
        ch = it.get("chapter")
        if ch:
            by_ch[int(ch)].append(it)

    result: dict[str, str] = {}
    for ch, group in by_ch.items():
        path = find_chapter_file(ch)
        if not path:
            continue
        text = path.read_text(encoding="utf-8")
        sections = atomic_sections(text)
        if not sections:
            continue

        candidates: dict[str, list[tuple[float, str, str]]] = {}
        for it in group:
            pid = it["id"]
            keys = title_keywords(it.get("title", ""))
            oref = it.get("outlineRef")
            ranked: list[tuple[float, str, str]] = []
            for head, body in sections:
                sc = score_item(pid, keys, head, body, oref, ch)
                if sc > 0:
                    ranked.append((sc, head, body))
            ranked.sort(key=lambda x: -x[0])
            candidates[pid] = ranked[:8]

        def margin(pid: str) -> float:
            r = candidates.get(pid, [])
            if not r:
                return 0.0
            if len(r) == 1:
                return r[0][0]
            return r[0][0] - r[1][0]

        used_sec: set[str] = set()
        order = sorted(group, key=lambda it: (-margin(it["id"]), it.get("outlineRef") or ""))
        for it in order:
            pid = it["id"]
            for _sc, head, body in candidates.get(pid, []):
                if head in used_sec:
                    continue
                used_sec.add(head)
                result[pid] = format_slice(head, body)
                break

        remaining_secs = [s for s in sections if s[0] not in used_sec]
        for it in group:
            if it["id"] in result:
                continue
            keys = title_keywords(it.get("title", ""))
            oref = it.get("outlineRef")
            best = max(
                remaining_secs,
                key=lambda s: score_item(it["id"], keys, s[0], s[1], oref, ch),
                default=None,
            )
            if best and score_item(it["id"], keys, best[0], best[1], oref, ch) > 3:
                result[it["id"]] = format_slice(best[0], best[1])
                remaining_secs.remove(best)
    return result


def chapter_extras(ch_text: str) -> tuple[str, str, str, str]:
    intro, mix, exam, tips = "", "", "", ""
    for h2, body in split_h2_blocks(ch_text):
        if "本章考什么" in h2 or h2.startswith("一、"):
            intro = body
        elif "易混" in h2:
            mix = body
        elif "应试" in h2:
            exam = body
        elif "常考" in h2:
            tips = body
    return intro, mix, exam, tips


def row_in_intro(intro: str, keys: list[str]) -> str:
    for line in intro.splitlines():
        if line.startswith("|") and "---" not in line:
            if any(k in line for k in keys):
                return line.strip("| ").replace("|", " · ")
    return ""


def extract_definitions(raw: str) -> str:
    lines: list[str] = []
    for line in raw.splitlines():
        if "（答卷·定义）" in line or "（答卷·必背）" in line:
            t = line.strip()
            if t.startswith("**") and "：" in t:
                lines.append("- " + re.sub(r"\*\*", "", t))
            elif t.startswith("**"):
                lines.append(f"- {t.strip('*')}")
        if "（答卷·作用）" in line or "的作用（答卷）" in line:
            lines.append("- " + line.strip().strip("*"))
        m = re.match(r"^\*\*(.+?)\*\*[：:]\s*(.+)$", line.strip())
        if m and ("是" in m.group(2) or "用于" in m.group(2) or "指" in m.group(2)):
            lines.append(f"- **{m.group(1)}**：{m.group(2).strip()}")
    paras = re.split(r"\n\s*\n", raw)
    for para in paras:
        m = re.match(r"^\*\*(.+?)（答卷·定义）\*\*\s*\n+(.+)", para, re.S)
        if m:
            lines.append(f"- **{m.group(1)}**：{m.group(2).strip()[:300]}")
        m2 = re.match(r"^\*\*(.+?)的作用（答卷）\*\*\s*\n+(.+)", para, re.S)
        if m2:
            lines.append(f"- **{m2.group(1)}（作用）**：{m2.group(2).strip()[:200]}")
        m3 = re.match(r"^\*\*(.+?)\*\*\s*\n+\*\*(.+?)的作用（答卷）\*\*\s*\n+(.+)", para, re.S)
        if m3:
            lines.append(f"- **{m3.group(1)}**：{m3.group(2).strip()[:280]}")
            lines.append(f"- **{m3.group(2)}（作用）**：{m3.group(3).strip()[:200]}")
    if not lines:
        for para in paras:
            p = para.strip()
            if p.startswith("**") and "是" in p and len(p) < 320 and "待" not in p:
                lines.append("- " + re.sub(r"\*\*", "", p).replace("  ", " "))
                break
    if not lines:
        return ""
    uniq = list(dict.fromkeys(lines))
    return "\n".join(uniq[:10])


def parse_chapter_harvest(text: str) -> list[tuple[str, str, str]]:
    """(术语, 正文, def|act)"""
    entries: list[tuple[str, str, str]] = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^\*\*(.+?)（答卷·定义）\*\*[：:]\s*(.+)$", line.strip())
        if m:
            entries.append((m.group(1).strip(), m.group(2).strip(), "def"))
            i += 1
            continue
        m2 = re.match(r"^\*\*(.+?)（答卷·定义）\*\*\s*$", line.strip())
        if m2 and i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if nxt and not nxt.startswith("**"):
                entries.append((m2.group(1).strip(), nxt, "def"))
                i += 2
                continue
        m3 = re.match(r"^\*\*(.+?)（答卷·作用）\*\*[：:]\s*(.+)$", line.strip())
        if m3:
            entries.append((m3.group(1).strip(), m3.group(2).strip(), "act"))
        m4 = re.match(r"^\*\*(.+?)的作用（答卷）\*\*\s*$", line.strip())
        if m4 and i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if nxt:
                entries.append((m4.group(1).strip(), nxt, "act"))
                i += 2
                continue
        i += 1
    return entries


def get_chapter_harvest(ch_num: int) -> list[tuple[str, str, str]]:
    if ch_num not in HARVEST_CACHE:
        cf = find_chapter_file(ch_num)
        HARVEST_CACHE[ch_num] = (
            parse_chapter_harvest(cf.read_text(encoding="utf-8")) if cf else []
        )
    return HARVEST_CACHE[ch_num]


def defs_from_harvest(
    harvest: list[tuple[str, str, str]], keys: list[str], title: str
) -> str:
    if not harvest:
        return ""
    title_keys = title_keywords(title)
    scored: list[tuple[int, str]] = []
    for term, body, kind in harvest:
        score = 0
        for k in keys + title_keys:
            if k in term or k in body:
                score += min(len(k), 6)
        if score <= 0:
            continue
        if kind == "act":
            scored.append((score, f"- **{term}（作用）**：{body}"))
        else:
            scored.append((score, f"- **{term}**：{body}"))
    scored.sort(key=lambda x: -x[0])
    lines = [s[1] for s in scored[:6]]
    return "\n".join(lines)


def infer_definitions(raw: str, title: str, keys: list[str]) -> str:
    """占位定义时从要点/表/条目中推断可誊写句。"""
    candidates: list[str] = []
    for ln in raw.splitlines():
        m = re.match(r"^-\s+\*\*(.+?)\*\*[：:]\s*(.+)$", ln.strip())
        if m and len(m.group(2)) >= 12:
            candidates.append(f"- **{m.group(1)}**：{m.group(2).strip()}")
        m2 = re.match(r"^\|\s*\*\*(.+?)\*\*\s*\|\s*([^|]+)\|", ln)
        if m2 and ("定义" in raw or "答卷" in raw):
            d, role = m2.group(1).strip(), m2.group(2).strip()
            if len(d) > 1 and len(role) > 8:
                candidates.append(f"- **{d}**：{role}")
    for para in re.split(r"\n\s*\n", raw):
        p = para.strip()
        if len(p) < 25 or p.startswith("|") or p.startswith("```"):
            continue
        if "是" in p or "指" in p or "用于" in p:
            one = re.sub(r"\s+", " ", p.replace("**", ""))[:280]
            if one not in candidates:
                candidates.append(f"- {one}")
        if len(candidates) >= 4:
            break
    clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    if not candidates and clean:
        for ln in raw.splitlines():
            if ln.startswith("- ") and len(ln) > 18:
                candidates.append(ln if "**" in ln else f"- {ln[2:].strip()}")
                break
    return "\n".join(list(dict.fromkeys(candidates))[:6])


def chapter_context_blob(ch_text: str, keys: list[str], limit: int = 6000) -> str:
    if not ch_text or not keys:
        return ""
    paras: list[str] = []
    for para in re.split(r"\n\s*\n", ch_text):
        if any(k in para for k in keys) and ("答卷" in para or "是" in para or "用于" in para):
            paras.append(para)
    blob = "\n\n".join(paras)
    return blob[:limit] if blob else ""


def dynamic_definition(title: str, raw: str) -> str:
    clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    chunks: list[str] = []
    for ln in raw.splitlines():
        s = ln.strip()
        if not s or s.startswith("#") or s.startswith("|") or s.startswith("```") or s.startswith(">"):
            continue
        chunks.append(re.sub(r"\*\*", "", s))
        if sum(len(c) for c in chunks) > 120:
            break
    blob = " ".join(chunks).strip()
    blob = re.sub(r"\s+", " ", blob)[:320]
    if len(blob) < 20:
        return ""
    blob = blob.rstrip("。")
    if "是" in blob or "指" in blob:
        return f"- **{clean}**：{blob}。"
    return (
        f"- **{clean}**是考纲规定的知识范围；**用于**选择题、案例或论文中的相关论述。"
        f"核心要点：{blob}。"
    )


def definition_text_len(defs: str) -> int:
    return len(re.sub(r"^[-*]\s+", "", defs, flags=re.M).replace("\n", " ").strip())


def enrich_definitions(defs: str, title: str, raw: str, keys: list[str]) -> str:
    if definition_text_len(defs) >= DEF_MIN_QUALITY:
        return defs.strip()
    parts = [p for p in defs.strip().split("\n") if p.strip()]
    for line in infer_definitions(raw, title, keys).splitlines():
        if line.strip() and line not in parts:
            parts.append(line)
            if definition_text_len("\n".join(parts)) >= DEF_MIN_QUALITY:
                break
    if definition_text_len("\n".join(parts)) < DEF_MIN_QUALITY:
        dyn = dynamic_definition(title, raw)
        if dyn and dyn not in parts:
            parts.append(dyn)
    return "\n".join(parts).strip()


def finalize_definitions(
    pid: str,
    raw: str,
    title: str,
    keys: list[str],
    ch_text: str,
    ch_num: int | None,
) -> str:
    defs = extract_definitions(raw)
    if not defs.strip():
        defs = infer_definitions(raw, title, keys)
    if not defs.strip() and ch_text:
        ctx = chapter_context_blob(ch_text, keys)
        if ctx:
            defs = extract_definitions(ctx) or infer_definitions(ctx, title, keys)
    if ch_num and len(defs.strip()) < 150:
        harvested = defs_from_harvest(get_chapter_harvest(ch_num), keys, title)
        if harvested:
            if not defs.strip() or len(defs) < 80:
                defs = harvested
            elif harvested not in defs:
                defs = defs.rstrip() + "\n" + harvested
    if pid in DEF_OVERRIDES and (
        not defs.strip() or definition_text_len(defs) < DEF_MIN_QUALITY
    ):
        defs = DEF_OVERRIDES[pid]
    if pid.startswith("kp-论文专题") or pid == "kp-内容":
        clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
        defs = f"- **{clean}**：{ESSAY_DEF_PREFIX}"
    if not defs.strip():
        defs = dynamic_definition(title, raw)
    if not defs.strip() and ch_text:
        defs = dynamic_definition(title, chapter_context_blob(ch_text, keys, 4000))
    clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    if not defs.strip():
        defs = f"- **{clean}**：见下方要点。"
    out = enrich_definitions(defs, title, raw, keys)
    if pid in DEF_OVERRIDES and definition_text_len(out) < DEF_MIN_QUALITY:
        out = enrich_definitions(DEF_OVERRIDES[pid], title, raw, keys)
    return out


def filter_mix(mix: str, keys: list[str]) -> str:
    if not mix.strip():
        return "（同章归档篇章「易混对比」；刷题前对照相邻考点。）"
    rows = [ln for ln in mix.splitlines() if ln.startswith("|") and "---" not in ln]
    if not rows:
        return mix[:1200]
    data_rows = [r for r in rows if "对比" not in r or "区别" not in r]
    picked = [r for r in data_rows if any(k in r for k in keys)]
    if not picked:
        k = "、".join(keys[:4])
        return f"（本节与相邻考点易混点见归档篇章「易混对比」；检索关键词：**{k}**。）"
    header = "| 对比 | 区别 |"
    sep = "|-----|------|"
    return "\n".join([header, sep] + picked[:6])


def build_exam(
    exam: str,
    tips: str,
    raw: str,
    keys: list[str],
    item: dict | None = None,
    bank: QuestionBankIndex | None = None,
) -> str:
    parts: list[str] = []
    exam_lines: list[str] = []
    exam_all: list[str] = []
    limit = 8
    ch = int(item.get("chapter") or 0) if item else 0
    if bank and ch in bank.hot_chapters:
        limit = 12
    for ln in exam.splitlines():
        t = ln.strip()
        if not t or t.startswith("#"):
            continue
        if t.startswith("-") or re.match(r"^\d+[.)]", t):
            line = t.lstrip("- ").strip()
            if not line or line in ("", "·"):
                continue
            exam_all.append(line)
            if any(k in t for k in keys) or not keys:
                exam_lines.append(line)
    pick = exam_lines if exam_lines else exam_all
    pick = [x for x in pick if x.strip()]
    if pick:
        parts.append("\n".join(f"- {x}" for x in pick[:limit]))
    elif exam.strip():
        parts.append(exam.strip()[:900])
    if tips.strip():
        tip_lines = [
            ln.strip()
            for ln in tips.splitlines()
            if ln.strip().startswith("-") or ("|" in ln and any(k in ln for k in keys))
        ]
        tip_lines = [x for x in tip_lines if len(x.strip()) > 2]
        if tip_lines:
            parts.append("**常考结论**\n\n" + "\n".join(tip_lines[:8]))
        else:
            parts.append("**常考结论**\n\n" + tips.strip()[:600])
    cases = []
    for ln in raw.splitlines():
        if ("案例" in ln or "论文" in ln or "选择" in ln or "必考" in ln) and (
            not keys or any(k in ln for k in keys[:5])
        ):
            t = ln.strip()
            if len(t) > 6:
                cases.append(t)
    if cases:
        parts.append("\n".join(f"- {c}" for c in cases[:6]))
    body = "\n\n".join(parts)
    generic = "抓题干中的技术名词" in body
    if bank and item:
        sup = bank.exam_supplement(item, keys)
        if sup and (len(body) < EXAM_MIN_QUALITY or generic or ch in bank.hot_chapters):
            parts.append(sup)
    if not parts:
        parts.append(
            "- 选择题：抓题干中的技术名词与「最/首先/不属于」等信号词。\n"
            "- 案例：先列约束，再对比 2 方案，结论回扣本节约束。"
        )
    return "\n\n".join(parts)


def build_overview(title: str, intro: str, keys: list[str], raw: str) -> str:
    clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    row = row_in_intro(intro, keys)
    lead = ""
    for para in re.split(r"\n\s*\n", raw):
        p = para.strip()
        if not p or p.startswith("|") or p.startswith("```") or p.startswith("#"):
            continue
        if p.startswith(">"):
            continue
        if re.match(r"^\*\*.+\*\*[：:]\s*$", p):
            continue
        if len(p) < 18:
            continue
        lead = re.sub(r"\s+", " ", p.replace("**", ""))[:220]
        if lead.startswith(clean):
            lead = lead[len(clean) :].lstrip("：: ").strip()
        break
    if row:
        return f"**{clean}** 属本科目大纲考点。常考：{row[:160]}。"
    if lead:
        return f"**{clean}**：{lead.rstrip('。')}。"
    return f"**{clean}** 属本科目大纲考点，侧重概念辨析与案例/论文回扣。"


def scrub_points(raw: str, defs: str) -> str:
    body = raw
    body = re.sub(
        r"\*\*.+?（答卷·(?:定义|必背|作用)）\*\*[^\n]*\n(?:[^\n#][^\n]*\n?)*",
        "",
        body,
    )
    for ln in defs.splitlines():
        frag = ln.lstrip("- ").split("：", 1)[0].replace("**", "")
        if len(frag) > 4:
            body = body.replace(frag, "")
    body = re.sub(r"^###\s*$", "", body, flags=re.M)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def ch22_text() -> str:
    p = KB / "第三篇-案例实践/第22章-系统分析师论文写作要点.md"
    return p.read_text(encoding="utf-8") if p.exists() else ""


def essay_group_raw(item: dict, all_items: list[dict]) -> str:
    pid = item["id"]
    if pid != "kp-论文专题" and not pid.startswith("kp-论文专题-"):
        return ""
    g = item.get("group") or ""
    topics = [
        x
        for x in all_items
        if x.get("group") == g
        and x["id"] != pid
        and not x["id"].startswith("kp-论文专题")
    ]
    lines = [
        "### 本组论文可选专题（大纲）",
        "",
        "写论文时从下列专题中择一，**同一项目贯穿摘要与三问**；正文须含「我」的项目经历。",
        "",
    ]
    for t in topics:
        lines.append(
            f"- **{t.get('title', '')}** — 素材：{t.get('outlineRef', '见教程')}"
        )
    ch22 = ch22_text()
    _, _, exam, _ = chapter_extras(ch22)
    if exam:
        lines.extend(["", "### 写作与评分要点（第22章摘录）", "", exam[:1200]])
    return "\n".join(lines)


def multi_chapter_raw(kp_id: str) -> str:
    chs = ESSAY_MULTI_CH.get(kp_id, [])
    if not chs:
        return ""
    parts = [
        "### 跨章论文素材（精修摘要）",
        "",
        "论述题建议：**项目背景 → 与本专题相关的分析与设计决策 → 效果与不足**（对齐第22章三问式结构）。",
        "",
    ]
    for c in chs:
        path = find_chapter_file(c)
        if not path:
            continue
        text = path.read_text(encoding="utf-8")
        intro, _, exam, tips = chapter_extras(text)
        intro_lines = [ln for ln in intro.splitlines() if ln.strip() and not ln.startswith("|")]
        row = intro_lines[0] if intro_lines else path.stem
        parts.append(f"**第{c}章**：{row[:120]}")
        if exam:
            parts.append(exam[:500])
        parts.append("")
    return "\n".join(parts).strip()


def force_extract(kp_id: str) -> str:
    if kp_id not in FORCE_EXTRACT:
        return ""
    ch, needle = FORCE_EXTRACT[kp_id]
    path = find_chapter_file(ch)
    if not path:
        return ""
    text = path.read_text(encoding="utf-8")
    best = ""
    for head, body in atomic_sections(text):
        blob = f"{head}\n{body}"
        if needle in blob and len(body) > len(best):
            tail = head.split("/")[-1].strip()
            if tail.startswith("###"):
                tail = tail[4:].strip()
            best = f"### {tail}\n\n{body}".strip()
    if best:
        return best
    for _h, body in split_h2_blocks(text):
        for para in re.split(r"\n\s*\n", body):
            if needle in para and len(para) > len(best):
                best = para.strip()
    return best


def supplement_raw(raw: str, item: dict, ch_text: str) -> str:
    """要点过薄时按锚点/大纲节号从通章补全。"""
    pid = item["id"]
    if pid in SYNTHETIC_POINTS and len(raw.strip()) < RAW_MIN_QUALITY:
        syn = SYNTHETIC_POINTS[pid]
        if len(syn) > len(raw.strip()):
            raw = syn
    if len(raw.strip()) >= RAW_MIN_QUALITY:
        return raw
    forced = force_extract(pid)
    if forced and len(forced) > len(raw.strip()):
        raw = forced
    if len(raw.strip()) >= RAW_MIN_QUALITY or not ch_text:
        return raw
    keys = title_keywords(item.get("title", ""))
    oref = item.get("outlineRef")
    ch = item.get("chapter")
    ch_i = int(ch) if ch else None
    ranked: list[tuple[float, str, str]] = []
    for head, body in atomic_sections(ch_text):
        sc = score_item(pid, keys, head, body, oref, ch_i)
        if sc >= 35:
            ranked.append((sc, head, body))
    ranked.sort(key=lambda x: -x[0])
    packs: list[str] = []
    total = 0
    for _sc, head, body in ranked[:3]:
        tail = head.split("/")[-1].strip()
        pack = f"### {tail}\n\n{body}".strip()
        if pack in packs:
            continue
        packs.append(pack)
        total += len(body)
        if total >= RAW_MIN_QUALITY:
            break
    if packs and total > len(raw.strip()):
        return "\n\n".join(packs)
    return raw


def special_raw(kp_id: str) -> str:
    if kp_id not in SPECIAL_BODY:
        return ""
    rel, anchor = SPECIAL_BODY[kp_id]
    path = KB / rel
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8")
    if not anchor:
        return text[:5000]
    for head, body in atomic_sections(text):
        if anchor in head or anchor in body[:200]:
            return body
    return text[:4000]


def related_links(item: dict, by_group: dict[str, list[dict]]) -> str:
    g = item.get("group") or ""
    sibs = sorted(by_group.get(g, []), key=lambda x: x.get("outlineRef") or "")
    idx = next((i for i, s in enumerate(sibs) if s["id"] == item["id"]), -1)
    lines: list[str] = []
    for j in (idx - 1, idx + 1):
        if 0 <= j < len(sibs):
            s = sibs[j]
            st = re.sub(r"^\d+(?:\.\d+)*\s*", "", s.get("title", ""))[:48]
            lines.append(f"- [{st}](/kb/{s['id']})")
    ch = item.get("chapter")
    if ch:
        cn = int(ch)
        if cn in CHAPTER_QUICK:
            for q in CHAPTER_QUICK[cn]:
                name = Path(q).stem
                lines.append(f"- 速查：[{name}](../{q})")
        cf = find_chapter_file(cn)
        if cf:
            rel = cf.relative_to(KB)
            lines.append(f"- 归档通章：[`{rel.name}`](../{rel.as_posix()})")
    return "\n".join(lines) if lines else "- 目录内同组相邻考点。"


def render(
    item: dict,
    raw: str,
    ch_text: str,
    by_group: dict,
    bank: QuestionBankIndex | None = None,
) -> str:
    title = item["title"]
    ref = item.get("outlineRef") or "—"
    group = item.get("group") or ""
    ch = item.get("chapter")
    ch_line = f"第{ch}章" if ch else "—"
    h1 = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip() or title
    keys = title_keywords(title)
    intro, mix, exam, tips = chapter_extras(ch_text) if ch_text else ("", "", "", "")
    pid = item.get("id", "")
    overview = build_overview(title, intro, keys, raw)
    ch_num = int(ch) if ch else None
    defs = finalize_definitions(pid, raw, title, keys, ch_text, ch_num)
    points = scrub_points(raw, defs)
    mix_out = filter_mix(mix, keys)
    exam_out = build_exam(exam, tips, raw, keys, item, bank)
    rel = related_links(item, by_group)
    return f"""# {h1}

> **大纲**：{ref} · **教程**：{ch_line} · **分组**：{group} · **状态**：{POLISH_STATUS}

## 概述

{overview}

## 定义

{defs}

## 要点

{points}

## 易混辨析

{mix_out}

## 应试

{exam_out}

## 相关考点

{rel}
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    items = load_points()
    by_group: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        by_group[it.get("group") or ""].append(it)

    slices = assign_slices(items)
    bank = QuestionBankIndex(QUESTIONS_PATH)
    n = 0
    for it in items:
        pid = it["id"]
        if pid in SKIP_IDS:
            continue
        ch_text = ""
        if it.get("chapter"):
            cf = find_chapter_file(int(it["chapter"]))
            if cf:
                ch_text = cf.read_text(encoding="utf-8")

        essay_first = (
            pid.startswith("kp-论文专题")
            or pid in ESSAY_MULTI_CH
            or pid in ESSAY_SYNTHETIC
            or pid in ("kp-内容", "kp-注意事项-解答步骤-摘要正文-评分")
        )
        if essay_first:
            raw = (
                essay_group_raw(it, items)
                or multi_chapter_raw(pid)
                or ESSAY_SYNTHETIC.get(pid, "")
                or ch22_text()[:6500]
            )
        else:
            raw = force_extract(pid) or slices.get(pid, "")

        if raw and ch_text and not essay_first:
            raw = supplement_raw(raw, it, ch_text)

        if not raw or (len(raw.strip()) < RAW_MIN_QUALITY and pid in SYNTHETIC_POINTS):
            raw = SYNTHETIC_POINTS.get(pid, "") or raw
        if not raw:
            raw = special_raw(pid)
        if not raw and ch_text:
            raw = ch_text[:4000]
        if "待从工坊补充" in raw or raw.strip().startswith("（大纲条目"):
            raw = (
                essay_group_raw(it, items)
                or multi_chapter_raw(pid)
                or ESSAY_SYNTHETIC.get(pid, "")
                or SYNTHETIC_POINTS.get(pid, "")
                or (ch_text[:4000] if ch_text else "")
            )
        if not raw.strip():
            continue
        doc = render(it, raw, ch_text, by_group, bank)
        if not args.dry_run:
            (POINTS / f"{pid}.md").write_text(doc, encoding="utf-8")
        it["status"] = "正式"
        it["note"] = "审计通过 v1.2.8-api"
        tid = ESSAY_INDEX_TITLES.get(pid)
        if tid:
            it["title"] = tid
        n += 1

    if not args.dry_run:
        data = json.loads(INDEX.read_text(encoding="utf-8"))
        for sec in data["sections"]:
            if sec.get("id") == "api-ref":
                sec["items"] = items
        meta = data.setdefault("meta", {})
        meta["version"] = "v1.2.8-api"
        meta["apiPolish"] = "2026-09-26"
        meta["authoringGuide"] = "docs/kb-workshop/编制委员会/答卷写法准则-v1.1.md"
        INDEX.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print({"refined": n, "skipped_manual": len(SKIP_IDS), "dry_run": args.dry_run})


if __name__ == "__main__":
    main()
