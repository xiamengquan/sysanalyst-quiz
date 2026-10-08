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

SKIP_IDS: set[str] = set()

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

POLISH_STATUS = "工坊精修 v1.3.4 · 审计通过"

DEF_OVERRIDES_PATH = Path(__file__).resolve().parent / "kb_def_overrides.json"
QUESTIONS_PATH = ROOT / "public/data/questions.json"
EXAM_MIN_QUALITY = 180

DEF_MIN_QUALITY = 140
RAW_MIN_QUALITY = 220

CHAPTER_QUICK: dict[int, list[str]] = {
    2: ["速查/前端友好-数学白话卡.md"],
    4: ["速查/REST架构风格-体系化学习卡.md"],
    7: ["速查/UML-体系化学习指南.md"],
    11: ["速查/需求工程-体系化学习路径.md", "速查/案例必答-需求获取五法对比卡.md"],
    12: ["速查/Web与AI智能体-架构选型四维度卡.md"],
}

HARVEST_CACHE: dict[int, list[tuple[str, str, str]]] = {}

# 教程章 → 题型提示（速懂节「考什么」）
CHAPTER_EXAM_HINT: dict[int, str] = {
    1: "标准层次、知识产权、法规概念辨析",
    2: "计算题（图论、决策树、概率统计、建模）",
    3: "Cache/RAID/存储层次、OS 与指令对比",
    4: "子网划分、协议对比、分布式与云",
    5: "范式/事务/备份、ER 与 SQL 场景",
    6: "ERP/BPR/EAI、CRM/SCM 概念",
    7: "开发模型选型、UML、过程改进",
    8: "挣值计算、WBS、风险与进度压缩",
    9: "访问控制模型、加密、容灾 RPO/RTO",
    10: "可行性四维、DFD、规划方法 BSP/CSF",
    11: "需求三层、获取方法、SRS/变更",
    12: "架构风格、SOA/微服务、质量属性",
    13: "耦合内聚、设计模式、人机交互",
    14: "测试阶段、黑/白盒、覆盖标准",
    15: "维护四类、系统转换策略",
    16: "Web 峰值、缓存限流、B/S 与 MVC",
    17: "嵌入式实时、调度与资源约束",
    18: "移动开发方式、离线与安全",
    19: "大数据 Lambda/Kappa、批流",
    20: "微服务治理、熔断限流、最终一致",
    21: "CPS/IoT、边缘与信息物理融合",
    22: "论文结构、摘要与评分要点",
}

POINT_EXAM_HINT: dict[str, str] = {
    "kp-云计算": "IaaS/PaaS/SaaS、云原生、虚拟化与上云案例（非子网计算）",
    "kp-微服务": "Service Mesh、网关、熔断限流、最终一致",
    "kp-网络安全-数据安全-系统安全": "等保2.0、零信任、访问控制、容灾指标",
    "kp-2-5": "CAP、一致性模型、分布式容错（非子网计算）",
    "kp-大数据": "5V、Lambda/Kappa、批流组件选型",
    "kp-概率统计-图论-预测决策-数学建模-工程伦理": "MST/最短路径、决策树 EMV、概率与建模步骤",
    "kp-英文阅读-领域术语": "软考英文题干、缩写全称与词义辨析",
    "kp-10-6": "质量属性场景六要素、ATAM 评估步骤",
    "kp-6-4": "挣值 PV/EV/AC、CPI/SPI 与 EAC 预测",
}

EXAM_OVERRIDES_PATH = Path(__file__).resolve().parent / "kb_exam_overrides.json"

PLACEHOLDER_DEF_RE = re.compile(r"是本节考纲要求掌握的概念、原则或方法体系")

ESSAY_PROCEDURE = (
    "### 科三论文作答流程\n\n"
    "1. **读题**：圈三问关键词，确认与本页「本组可选专题」一致。\n"
    "2. **列提纲**：同一项目背景 + 每问小标题（各约 600～800 字）。\n"
    "3. **写摘要**：约 300～320 字，背景→本人角色→方案要点→效果与不足。\n"
    "4. **正文分段**：按三问各写一段，以「我」为中心写决策与量化效果。\n"
    "5. **自检**：摘要与正文一致、术语准确、字数与分段符合评分要点。"
)


def polish_override_block(text: str) -> str:
    lines: list[str] = []
    for ln in text.splitlines():
        if PLACEHOLDER_DEF_RE.search(ln):
            continue
        lines.append(ln)
    return "\n".join(lines).strip()


def load_def_overrides() -> dict[str, str]:
    if DEF_OVERRIDES_PATH.is_file():
        data = json.loads(DEF_OVERRIDES_PATH.read_text(encoding="utf-8"))
        return {str(k): polish_override_block(str(v)) for k, v in data.items()}
    return {}


DEF_OVERRIDES: dict[str, str] = load_def_overrides()

PROCEDURE_OVERRIDES_PATH = Path(__file__).resolve().parent / "kb_procedure_overrides.json"


def load_procedure_overrides() -> dict[str, str]:
    if PROCEDURE_OVERRIDES_PATH.is_file():
        data = json.loads(PROCEDURE_OVERRIDES_PATH.read_text(encoding="utf-8"))
        return {str(k): str(v).strip() for k, v in data.items()}
    return {}


PROCEDURE_OVERRIDES: dict[str, str] = load_procedure_overrides()


def load_exam_overrides() -> dict[str, str]:
    if EXAM_OVERRIDES_PATH.is_file():
        data = json.loads(EXAM_OVERRIDES_PATH.read_text(encoding="utf-8"))
        return {str(k): str(v).strip() for k, v in data.items()}
    return {}


EXAM_OVERRIDES: dict[str, str] = load_exam_overrides()

GENERIC_ROLE_RE = re.compile(
    r"\*\*作用\*\*：(?:"
    r"用于[「\"][^」\"]+[」\"]相关选择题、案例或论文中的识别与辨析"
    r"|用于考试中的概念辨析、计算或案例/论文回扣"
    r"|用于与本节相关的选择题、案例或论文论述"
    r"|用于在分析、设计或测试中落实「[^」]+」相关约束与验收"
    r")[。.]?$"
)


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
    "kp-2-7": (4, "SOAP"),
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
    "kp-2-7": """**架构约束（选择高频）**：客户端-服务器、**无状态**、可缓存、**统一接口**（URI + 动词）、分层系统、按需代码（可选）。

**HTTP 方法**：GET 查（安全、幂等）；POST 建（通常不幂等）；PUT 全量更、DELETE 删（幂等）。

**URI 惯例**：名词复数集合 `/surveys`；实例 `/surveys/{id}`；编辑/视图可建模为子资源或查询参数。

**REST vs SOAP**：REST 用 URI 标识资源、HTTP 动词与无状态；SOAP 偏 XML 信封、RPC 与企业 WS-Security。案例常考 REST 选型理由（2016 上）与资源抽象（2018 上）。""",
    "kp-5-3": """> 教程无独立 7.3 专节；以下为备考提纲。

**集成开发环境（IDE）** 是集编辑、编译/构建、调试、版本管理于一体的软件开发环境。

**CASE 工具** 是在软件工程各阶段提供建模、分析、生成与管理的计算机辅助软件工程工具。

- **开发环境**：语言/框架 SDK、构建工具（Maven/Gradle）、调试器、静态分析插件。
- **CASE 分类**：按阶段分为需求（建模/原型）、设计（UML/CASE）、实现（代码生成）、测试（用例管理）、维护（逆向/再工程）工具。
- **选型要点**：与团队过程（瀑布/敏捷）、制品库、CI 是否集成；避免「工具堆叠、流程不配套」。""",
    "kp-软件产品线": """**软件产品线** 是在共享核心资产基础上，通过变体绑定为不同客户/市场交付系列产品的组织级复用方式。

- **核心资产**：可复用架构、组件、需求/设计模型与过程框架，是产品线的根基。
- **领域工程与应用工程**：领域工程负责构建与演进核心资产；应用工程基于资产绑定变体、交付具体产品。
- **过程**：领域分析 → 领域设计 → 领域实现；新需求优先映射到已有变体机制。
- **变体机制**：配置、参数化、扩展点/插件等表达产品差异的手段。
- **与单项目复用区别**：产品线是组织级、长期演进的复用战略，而非一次性代码拷贝；需配套组织与资产管理。""",
    "kp-计算机辅助软件工程-CASE": """> 教程第7章无独立 CASE 专节；以下为按大纲 7.3 整理的备考提纲。

**计算机辅助软件工程（CASE）** 是用计算机工具辅助软件生命周期各阶段活动（分析、设计、编码、测试、维护）的技术与方法体系。

- **CASE 分类（按阶段）**：上游 CASE（需求/分析/设计建模）与下游 CASE（代码生成、测试、维护）；集成 CASE（I-CASE）贯通全周期。
- **典型工具**：集成开发环境（IDE）、建模工具（UML）、配置管理、自动化测试、逆向/再工程工具。
- **核心价值**：提高开发效率与制品一致性、支持文档自动生成与变更追踪。
- **选型要点**：与团队过程（瀑布/敏捷）、制品库与 CI/CD 流水线集成；避免工具堆叠而流程不配套。""",
    "kp-云计算": """> 大纲 4.8 · 云计算与虚拟化（非整章网络协议）；以下为备考提纲。

**云计算** 是按需、可计量、通过网络访问的可扩展 IT 资源与服务模式（IaaS/PaaS/SaaS）。

- **服务模型**：IaaS（基础设施）、PaaS（平台）、SaaS（软件）；选型看控制粒度与运维责任。
- **部署模式**：公有云、私有云、混合云、社区云；权衡成本、合规与可控性。
- **云原生**：容器（Docker）、编排（Kubernetes）、微服务、DevOps、持续交付；强调弹性与可观测性。
- **虚拟化与资源池**：计算/存储/网络虚拟化，提高利用率与快速 provisioning。
- **与分布式**：云计算依托分布式与数据中心技术；案例常考 **弹性伸缩、多租户、灾备**。
- **MLOps（了解）**：模型训练/部署/监控的运维体系，常与云 PaaS、数据平台结合。""",
    "kp-开源社区-许可-语言平台-框架库-服务器-工具-评估": """> 大纲专章（结合第7章工具、第16—21章开源组件）；以下为按大纲整理的备考提纲。

**开源软件** 指源码可获取、在开源许可证约束下使用、修改与再发布的软件；**开源社区** 是围绕开源项目的开发者协作生态。

- **开源许可证**：宽松型（MIT、BSD、Apache 2.0，允许闭源再分发，Apache 附加专利授权）与著佐权型（GPL 系列，衍生作品须同许可开源；LGPL 对库类放宽链接限制）。
- **语言平台与框架库**：选型看生态成熟度、社区活跃度（提交/维护者/发布频率）、文档与学习成本。
- **服务器与工具**：Web 服务器、数据库、中间件、容器与编排等开源栈；关注许可证兼容与商业支持可得性。
- **开源评估维度**：许可证合规、社区健康度、安全响应（漏洞修复时效）、版本演进路线、厂商中立性。
- **风险对策**：SBOM 清单、许可证扫描、漏洞跟踪与补丁策略。""",
}

SPECIAL_BODY: dict[str, tuple[str, str | None]] = {
    "kp-软件过程改进": (
        "第一篇-基础知识/第07章-软件工程.md",
        "CMMI",
    ),
    "kp-面向对象技术": (
        "第一篇-基础知识/第07章-软件工程.md",
        "UML",
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


# 教程无对应专节的考点：要点节强制使用 SYNTHETIC_POINTS 合成内容（防 slices 错配整章/他节）
SYNTHETIC_ONLY: set[str] = {
    "kp-云计算",
    "kp-开源社区-许可-语言平台-框架库-服务器-工具-评估",
    "kp-计算机辅助软件工程-CASE",
    "kp-软件产品线",
}

# 语义相关考点（补充同组相邻链接）
RELATED_OVERRIDES: dict[str, list[str]] = {
    "kp-需求工程": ["kp-9-3", "kp-面向对象技术", "kp-软件生命周期"],
    "kp-面向对象技术": ["kp-7-4", "kp-7-5", "kp-需求工程"],
    "kp-7-4": ["kp-面向对象技术", "kp-9-3", "kp-10-1"],
    "kp-10-1": ["kp-10-5", "kp-10-6", "kp-微服务"],
    "kp-10-5": ["kp-10-6", "kp-12-1", "kp-10-1"],
    "kp-10-6": ["kp-10-5", "kp-10-1", "kp-微服务"],
    "kp-3-1": ["kp-3-2", "kp-3-7", "kp-数据仓库"],
    "kp-3-2": ["kp-3-1", "kp-3-4", "kp-数据挖掘"],
    "kp-微服务": ["kp-10-1", "kp-应用集成-服务集成", "kp-云计算"],
    "kp-云计算": ["kp-微服务", "kp-大数据", "kp-2-5"],
    "kp-2-5": ["kp-云计算", "kp-2-7", "kp-微服务"],
    "kp-大数据": ["kp-云计算", "kp-4-4-2", "kp-数据挖掘"],
    "kp-系统计划和分析": ["kp-4-2", "kp-8-1", "kp-2-4"],
    "kp-网络安全-数据安全-系统安全": ["kp-7-6", "kp-9-1", "kp-运维指标-MTTR-MTBF-MTTF-MTTA"],
    "kp-概率统计-图论-预测决策-数学建模-工程伦理": [
        "kp-企业法律制度-会计-财务成本-组织-HR-文化-IT-审计",
        "kp-英文阅读-领域术语",
    ],
    "kp-英文阅读-领域术语": [
        "kp-概率统计-图论-预测决策-数学建模-工程伦理",
        "kp-标准类型-生命周期-知识产权",
    ],
    "kp-6-4": ["kp-6-3", "kp-6-8", "kp-6-1"],
    "kp-注意事项-解答步骤-摘要正文-评分": ["kp-论文专题", "kp-应用系统分析与设计"],
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


def polish_def_act_line(line: str) -> str:
    """将「描述…」等简写润色为答卷式「是… + **作用**：用于…」。"""
    line = line.replace("用于主要用于", "主要用于").replace("用于用于", "用于")
    line = re.sub(r"(\*\*作用\*\*[：:])用于([^。；\n]{0,12}?用于)", r"\1\2", line)
    m = re.match(r"^- \*\*(.+?)\*\*[：:]\s*(.+)$", line.strip())
    if not m:
        return line.strip()
    term, rest = m.group(1).strip(), m.group(2).strip()
    if "（答卷" in term or term.startswith("采用"):
        return line.strip()
    used_tail = re.search(r"[；;]\*\*用于\*\*(.+)$", rest)
    if used_tail and "**作用**" not in rest:
        rest = rest[: used_tail.start()] + "。**作用**：用于" + used_tail.group(1).strip()
    act_m = re.search(r"\*\*作用\*\*[：:]\s*(.+)$", rest)
    def_body = rest[: act_m.start()].strip() if act_m else rest
    act_body = act_m.group(1).strip() if act_m else ""
    def_body = def_body.rstrip("。")
    if def_body and not re.search(r"(是|指)", def_body):
        if def_body.startswith("描述"):
            inner = def_body[2:].strip()
            if term.endswith("图"):
                def_body = f"是用于{inner}的 UML {term}"
            else:
                def_body = f"是用于{inner}的{term}"
        elif def_body.startswith("表达"):
            def_body = f"是{def_body}"
        else:
            def_body = f"是{def_body.lstrip('是')}"
    if act_body:
        act_body = act_body.rstrip("。")
        if (
            act_body
            and not act_body.startswith(("用于", "主要用于"))
            and "用于" not in act_body[:14]
        ):
            act_body = f"用于{act_body}"
        return f"- **{term}**：{def_body}。**作用**：{act_body}。"
    if def_body:
        return f"- **{term}**：{def_body}。"
    return line.strip()


def extract_nested_def_bullets(raw: str) -> list[str]:
    """收割要点下嵌套的「术语：定义 + 作用」条目，供定义节展开。"""
    out: list[str] = []
    lines = raw.splitlines()
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        is_group = bool(
            re.match(r"^- \*\*.+\*\*", stripped)
            and (
                "定义" in stripped
                or "作用" in stripped
                or "答卷" in stripped
                or "速记" in stripped
                or "BCE" in stripped
            )
        )
        if is_group:
            i += 1
            while i < len(lines):
                child = lines[i]
                cs = child.strip()
                if cs.startswith("- **") and not child.startswith((" ", "\t")):
                    break
                m = re.match(r"^\s+- \*\*(.+?)\*\*[：:]\s*(.+)$", child)
                if m:
                    term = m.group(1).strip()
                    if "详解" in cs or term.startswith("采用"):
                        i += 1
                        continue
                    out.append(polish_def_act_line(f"- **{term}**：{m.group(2).strip()}"))
                i += 1
            continue
        m_top = re.match(r"^- \*\*(.+?)\*\*[：:]\s*(.+)$", stripped)
        if m_top and "**作用**" in stripped and "（答卷" not in m_top.group(1):
            out.append(polish_def_act_line(stripped))
        i += 1
    return list(dict.fromkeys(out))


def merge_definition_lines(*blocks: str, limit: int = 14) -> str:
    seen: set[str] = set()
    lines: list[str] = []
    for block in blocks:
        for ln in (block or "").splitlines():
            s = ln.strip()
            if not s.startswith("- "):
                continue
            key = re.sub(r"\*\*", "", s.split("：", 1)[0].split(":", 1)[0])
            if key in seen:
                continue
            seen.add(key)
            lines.append(polish_def_act_line(s))
            if len(lines) >= limit:
                return "\n".join(lines)
    return "\n".join(lines)


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
            lines.append(f"- **{m.group(1)}**：{m.group(2).strip()[:480]}")
        m2 = re.match(r"^\*\*(.+?)的作用（答卷）\*\*\s*\n+(.+)", para, re.S)
        if m2:
            lines.append(f"- **{m2.group(1)}（作用）**：{m2.group(2).strip()[:320]}")
        m3 = re.match(r"^\*\*(.+?)\*\*\s*\n+\*\*(.+?)的作用（答卷）\*\*\s*\n+(.+)", para, re.S)
        if m3:
            lines.append(f"- **{m3.group(1)}**：{m3.group(2).strip()[:400]}")
            lines.append(f"- **{m3.group(2)}（作用）**：{m3.group(3).strip()[:320]}")
    for nl in extract_nested_def_bullets(raw):
        if nl not in lines:
            lines.append(nl)
    if not lines:
        for para in paras:
            p = para.strip()
            if p.startswith("**") and "是" in p and len(p) < 320 and "待" not in p:
                lines.append("- " + re.sub(r"\*\*", "", p).replace("  ", " "))
                break
    if not lines:
        return ""
    polished = [polish_def_act_line(x) if x.startswith("- ") else x for x in lines]
    uniq = list(dict.fromkeys(polished))
    return "\n".join(uniq[:14])


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
        m5 = re.match(r"^- \*\*(.+?)（答卷）\*\*[：:]\s*(.+)$", line.strip())
        if m5:
            term, rest = m5.group(1).strip(), m5.group(2).strip()
            act_m = re.search(r"\*\*作用\*\*[：:]\s*(.+)$", rest)
            if act_m:
                def_part = rest[: act_m.start()].strip().rstrip("。")
                entries.append((term, def_part, "def"))
                entries.append((term, act_m.group(1).strip(), "act"))
            elif "是" in rest or "指" in rest:
                entries.append((term, rest, "def"))
            i += 1
            continue
        m6 = re.match(
            r"^\|\s*\*\*(.+?)\*\*\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|", line.strip()
        )
        if m6 and "答卷" in line:
            term, dcol, acol = m6.group(1).strip(), m6.group(2).strip(), m6.group(3).strip()
            if len(dcol) > 6:
                entries.append((term, dcol, "def"))
            if len(acol) > 6 and ("用于" in acol or "作用" in acol):
                entries.append((term, acol.replace("用于", "").strip(), "act"))
        i += 1
    return entries


def harvest_entries_from_text(text: str) -> list[tuple[str, str, str]]:
    entries = list(parse_chapter_harvest(text))
    seen = {(t, k) for t, _b, k in entries}
    for line in parse_chapter_inline_def_act(text):
        m = re.match(
            r"^- \*\*(.+?)\*\*[：:]\s*(.+?)\*\*作用\*\*[：:]\s*(.+?)\。?$",
            line.strip(),
        )
        if not m:
            continue
        term = m.group(1).strip()
        if (term, "def") not in seen:
            entries.append((term, m.group(2).strip().rstrip("。"), "def"))
            seen.add((term, "def"))
        if (term, "act") not in seen:
            entries.append((term, m.group(3).strip().rstrip("。"), "act"))
            seen.add((term, "act"))
    return entries


def get_chapter_harvest(ch_num: int) -> list[tuple[str, str, str]]:
    if ch_num not in HARVEST_CACHE:
        cf = find_chapter_file(ch_num)
        HARVEST_CACHE[ch_num] = (
            harvest_entries_from_text(cf.read_text(encoding="utf-8")) if cf else []
        )
    return HARVEST_CACHE[ch_num]


def defs_from_harvest(
    harvest: list[tuple[str, str, str]], keys: list[str], title: str
) -> str:
    if not harvest:
        return ""
    title_keys = title_keywords(title)
    clean_title = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    buckets: dict[str, dict[str, str]] = {}
    scores: dict[str, int] = {}
    for term, body, kind in harvest:
        score = 0
        for k in keys + title_keys:
            if k in term or k in body or k in clean_title:
                score += min(len(k), 6)
        if score <= 0:
            continue
        slot = buckets.setdefault(term, {"def": "", "act": ""})
        scores[term] = max(scores.get(term, 0), score)
        if kind == "act":
            slot["act"] = body
        else:
            slot["def"] = body
    ranked = sorted(scores.keys(), key=lambda t: -scores[t])
    lines: list[str] = []
    for term in ranked[:10]:
        b = buckets[term]
        if b["def"] and b["act"]:
            lines.append(
                polish_def_act_line(
                    f"- **{term}**：{b['def']}。**作用**：{b['act']}"
                )
            )
        elif b["def"]:
            lines.append(polish_def_act_line(f"- **{term}**：{b['def']}"))
        elif b["act"]:
            lines.append(f"- **{term}（作用）**：{b['act']}")
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
    if re.search(r"^#\s+第\s*\d+章", raw, re.M):
        raw = re.sub(r"^#\s+第\s*\d+章[\s\S]*?(?=^##\s|\Z)", "", raw, count=1, flags=re.M)
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


def _def_has_what(text: str) -> bool:
    return bool(
        re.search(
            r"(\*\*[^*]+\*\*[：:][^。\n]{0,96}是"
            r"|（答卷·定义）[：:][^。\n]{0,96}是"
            r"|是指|指的是|定义为|是一种|是一类|是一套)",
            text,
        )
    )


def _term_base(term: str) -> str:
    t = re.sub(r"（.+?）", "", term).strip()
    return re.sub(r"\s+[A-Za-z][A-Za-z0-9+/.-]*$", "", t).strip()


def clean_definition_output(defs: str) -> str:
    """去掉合并后残留的裸「定义/作用」行、易混说明行与「（作用）」重复条目。"""
    main_terms: set[str] = set()
    for ln in defs.splitlines():
        m = re.match(r"^- \*\*(.+?)\*\*[：:]", ln.strip())
        if m and "（作用）" not in m.group(1):
            main_terms.add(_term_base(m.group(1)))
    lines: list[str] = []
    seen_plain: set[str] = set()
    for ln in defs.splitlines():
        s = ln.strip()
        if not s.startswith("- "):
            continue
        if re.match(r"^- \*\*(定义|作用)\*\*[：:]", s):
            continue
        if re.match(r"^- [^*].*（答卷·定义）", s):
            continue
        if re.match(r"^- \*\*(.+?)（答卷·定义）\*\*\s*$", s):
            continue
        if not re.match(r"^- \*\*.+\*\*[：:]", s):
            continue
        if "（答卷·定义 / 作用）" in s or "（定义 / 作用速记）" in s:
            continue
        if "易混" in s and "不要混答" in s:
            continue
        m_act = re.match(r"^- \*\*(.+?)（作用）\*\*[：:]", s)
        if m_act and _term_base(m_act.group(1)) in main_terms:
            continue
        s = polish_def_act_line(s)
        plain = re.sub(r"\*\*", "", s)
        if plain in seen_plain:
            continue
        seen_plain.add(plain)
        lines.append(s)
        if len(lines) >= 14:
            break
    return "\n".join(lines)


def harvest_term_buckets(ch_num: int | None) -> dict[str, dict[str, str]]:
    if not ch_num:
        return {}
    buckets: dict[str, dict[str, str]] = {}
    for term, body, kind in get_chapter_harvest(ch_num):
        slot = buckets.setdefault(term.strip(), {"def": "", "act": ""})
        if kind == "act":
            slot["act"] = body.strip()
        else:
            slot["def"] = body.strip()
    return buckets


def parse_chapter_inline_def_act(text: str) -> list[str]:
    """通章行内「- **术语**：…。**作用**：…」。"""
    out: list[str] = []
    for m in re.finditer(
        r"^- \*\*(.+?)\*\*[：:]\s*(.+?)\*\*作用\*\*[：:]\s*(.+?)\.?\s*$",
        text,
        re.M,
    ):
        term = m.group(1).strip()
        if "答卷" in term and "（" not in term:
            term = re.sub(r"（答卷）\s*$", "", term)
        line = polish_def_act_line(
            f"- **{term}**：{m.group(2).strip()}。**作用**：{m.group(3).strip()}"
        )
        if line not in out:
            out.append(line)
    return out


def parse_chapter_heading_blocks(text: str) -> list[str]:
    """通章 **模型名**： + 子 bullet 列表 → 定义 + 作用。"""
    out: list[str] = []
    for m in re.finditer(
        r"^\*\*(.+?)\*\*[：:]\s*\n+((?:[ \t]*- .+\n)+)",
        text,
        re.M,
    ):
        term = m.group(1).strip()
        if len(term) > 36 or "答卷" in term or term.endswith("★必考"):
            continue
        bullets = [
            b.strip()[2:].strip()
            for b in m.group(2).splitlines()
            if b.strip().startswith("- ")
        ]
        if not bullets:
            continue
        def_bits: list[str] = []
        act_hint = ""
        for b in bullets:
            if re.match(r"^(适用|优点|缺点|特点|限制)", b):
                if b.startswith("适用"):
                    act_hint = b.rstrip("。")
                continue
            def_bits.append(b.rstrip("。"))
        if not def_bits:
            continue
        def_body = "；".join(def_bits[:3])
        if not re.search(r"(是|指|由|含|通过)", def_body):
            def_body = f"是{def_body}"
        act_body = act_hint or f"用于与本节相关的模型选型、特点对比与案例论述"
        if (
            act_body
            and not act_body.startswith(("用于", "主要用于"))
            and "用于" not in act_body[:14]
        ):
            act_body = f"用于{act_body.removeprefix('适用：').removeprefix('适用')}"
        out.append(
            polish_def_act_line(
                f"- **{term}**：{def_body}。**作用**：{act_body}"
            )
        )
    return list(dict.fromkeys(out))


def supplement_missing_act(
    defs: str, ch_num: int | None, title: str, raw: str
) -> str:
    """为缺「作用/用于」的 bullet 补全（优先通章 harvest，其次本节语境）。"""
    buckets = harvest_term_buckets(ch_num)
    clean_title = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    lines_out: list[str] = []
    for ln in defs.splitlines():
        s = ln.strip()
        if not s.startswith("- "):
            continue
        polished = polish_def_act_line(s)
        if re.search(r"\*\*作用\*\*|主要用于|用于", polished):
            lines_out.append(polished)
            continue
        tm = re.match(r"^- \*\*(.+?)\*\*[：:]\s*(.+)$", polished)
        if not tm:
            lines_out.append(polished)
            continue
        term, rest = tm.group(1).strip(), tm.group(2).strip().rstrip("。")
        base_term = re.sub(r"（.+?）$", "", term).strip()
        act = ""
        for key in (term, base_term):
            if key in buckets and buckets[key]["act"]:
                act = buckets[key]["act"]
                break
        if not act:
            for k, slot in buckets.items():
                if k in term or term in k or k in base_term:
                    act = slot["act"]
                    if act:
                        break
        if not act:
            act_m = re.search(
                rf"\*\*{re.escape(base_term)}[^*]*\*\*[^\n]*作用[：:]\s*([^\n。]+)",
                raw,
            )
            if act_m:
                act = act_m.group(1).strip()
        if not act:
            act = (
                f"用于在综合知识选择与案例/论文中准确识别「{clean_title}」"
                "相关概念、方法步骤及其适用边界与易混点辨析"
            )
        if not act.startswith(("用于", "主要用于")) and "用于" not in act[:14]:
            act = f"用于{act}"
        def_body = rest.split("。**作用**")[0].rstrip("。")
        lines_out.append(f"- **{term}**：{def_body}。**作用**：{act}。")
    return "\n".join(lines_out)


def purge_placeholder_defs(defs: str) -> str:
    lines = [
        ln
        for ln in defs.splitlines()
        if ln.strip() and not PLACEHOLDER_DEF_RE.search(ln)
    ]
    return "\n".join(lines).strip()


def ensure_section_def_act(defs: str, title: str) -> str:
    """定义节整体须同时出现「是什么」与「作用/用于」（答卷准则 v1.1）。"""
    text = purge_placeholder_defs(defs.strip())
    if not text:
        return text
    if "论文可从本组大纲专题中择一" in text:
        return text
    clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    has_role = bool(re.search(r"(作用|用于|主要用于)", text))
    if _def_has_what(text) and has_role:
        return text
    if _def_has_what(text) and not has_role:
        lines = text.splitlines()
        for i in range(len(lines) - 1, -1, -1):
            ln = lines[i].strip()
            if ln.startswith("- ") and _def_has_what(ln):
                lines[i] = (
                    ln.rstrip("。")
                    + "。**作用**：用于与本节相关的选择题、案例或论文论述。"
                )
                return "\n".join(lines)
    if has_role and not _def_has_what(text):
        text = (
            text.rstrip()
            + f"\n- **{clean}**：是本节考纲要求掌握的概念、原则或方法体系。"
        )
        return text
    if not _def_has_what(text):
        lead = text.splitlines()[0].strip()
        if lead.startswith("- "):
            lead = lead[2:]
        text = (
            f"- **{clean}**：是{lead.lstrip('*')}。"
            if not _def_has_what(lead)
            else f"- **{clean}**：{lead}"
        )
    return (
        text.rstrip()
        + f"\n- **{clean}（应试）**：**作用**：用于考试中的概念辨析、计算或案例/论文回扣。"
    )


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


def parse_chaptersubsubsection_defs(text: str) -> list[str]:
    """从通章 #### / （答卷·定义）块收割「定义 + 作用」完整句。"""
    out: list[str] = []
    for part in re.split(r"\n(?=####\s+)", text):
        m_h = re.match(r"^####\s+(.+?)\s*$", part, re.M)
        if not m_h:
            continue
        term = re.sub(r"（答卷）\s*$", "", m_h.group(1).strip())
        def_m = re.search(r"^\*\*定义\*\*[：:]\s*(.+)$", part, re.M)
        act_m = re.search(r"^\*\*作用\*\*[：:]\s*(.+)$", part, re.M)
        if def_m and act_m:
            line = (
                f"- **{term}**：{def_m.group(1).strip()}。"
                f"**作用**：{act_m.group(1).strip()}"
            )
            out.append(polish_def_act_line(line))
    for m in re.finditer(
        r"\*\*(.+?)（答卷·定义）\*\*\s*\n+([^\n]+(?:\n(?!\*\*[^*]+（答卷)[^\n]+)*)\s*\n+\*\*作用\*\*[：:]\s*([^\n]+)",
        text,
    ):
        term = m.group(1).strip()
        def_body = re.sub(r"\s+", " ", m.group(2).strip())
        act_body = m.group(3).strip()
        out.append(
            polish_def_act_line(
                f"- **{term}**：{def_body}。**作用**：{act_body}"
            )
        )
    return list(dict.fromkeys(out))


def defs_from_chapter_methods(
    ch_text: str,
    pid: str,
    title: str,
    keys: list[str],
    outline_ref: str | None,
    ch_num: int | None,
) -> str:
    ranked: list[tuple[float, str]] = []
    for head, body in atomic_sections(ch_text):
        sc = score_item(pid, keys, head, body, outline_ref, ch_num)
        block = parse_chaptersubsubsection_defs(body)
        if not block:
            block = parse_chapter_inline_def_act(body)
        if not block:
            block = parse_chapter_heading_blocks(body)
        if sc >= 28 and block:
            ranked.append((sc + len(block) * 4, "\n".join(block)))
    ranked.sort(key=lambda x: -x[0])
    if ranked:
        return merge_definition_lines(ranked[0][1], limit=14)
    return ""


def authoritative_override(pid: str) -> str | None:
    """MANUAL / 重建 override 含多条「作用」时，定义节仅以 override 为准（防章内串节）。"""
    if pid not in DEF_OVERRIDES:
        return None
    ov = DEF_OVERRIDES[pid].strip()
    act_n = ov.count("**作用**")
    if act_n < 2 or definition_text_len(ov) < 120:
        return None
    return ov


def finalize_definitions(
    pid: str,
    raw: str,
    title: str,
    keys: list[str],
    ch_text: str,
    ch_num: int | None,
    outline_ref: str | None = None,
) -> str:
    auth_ov = authoritative_override(pid)
    if auth_ov:
        body = clean_definition_output(auth_ov)
        body = supplement_missing_act(body, ch_num, title, raw)
        body = ensure_section_def_act(body, title)
        clean_t = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
        body = filter_definitions_by_title(body, keys, clean_t)
        role_map = build_role_map_from_chapter(ch_text) if ch_text else {}
        body = normalize_definition_bullets(body)
        body = improve_definition_roles(body, role_map, clean_t)
        return apply_role_map_to_definitions(body, role_map)
    defs = extract_definitions(raw)
    if not defs.strip():
        defs = infer_definitions(raw, title, keys)
    if not defs.strip() and ch_text:
        ctx = chapter_context_blob(ch_text, keys)
        if ctx:
            defs = extract_definitions(ctx) or infer_definitions(ctx, title, keys)
    nested = extract_nested_def_bullets(raw)
    if nested:
        defs = merge_definition_lines(defs, "\n".join(nested))
    if ch_text:
        sec = defs_from_chapter_methods(
            ch_text, pid, title, keys, outline_ref, ch_num
        )
        if sec:
            defs = merge_definition_lines(defs, sec, limit=14)
    if ch_num and len(defs.strip()) < 200:
        harvested = defs_from_harvest(get_chapter_harvest(ch_num), keys, title)
        if harvested:
            defs = merge_definition_lines(defs, harvested)
    if ch_text and definition_text_len(defs) < 380 and not authoritative_override(pid):
        extra: list[str] = []
        for head, body in atomic_sections(ch_text):
            sc = score_item(pid, keys, head, body, outline_ref, ch_num)
            if sc < 22:
                continue
            extra.extend(parse_chaptersubsubsection_defs(body))
            extra.extend(parse_chapter_inline_def_act(body))
            extra.extend(parse_chapter_heading_blocks(body))
        if extra:
            defs = merge_definition_lines(defs, "\n".join(dict.fromkeys(extra)), limit=14)
    if pid in DEF_OVERRIDES and (
        not defs.strip() or definition_text_len(defs) < DEF_MIN_QUALITY
    ):
        defs = DEF_OVERRIDES[pid]
    if pid.startswith("kp-论文专题") or pid == "kp-内容":
        clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
        defs = (
            f"- **{clean}**：是科三论文可选专题方向；{ESSAY_DEF_PREFIX.rstrip('。')}。"
            "**作用**：用于科三论文选题与摘要/正文三问结构对齐。"
        )
    if not defs.strip():
        defs = dynamic_definition(title, raw)
    if not defs.strip() and ch_text:
        defs = dynamic_definition(title, chapter_context_blob(ch_text, keys, 4000))
    clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    if not defs.strip():
        defs = f"- **{clean}**：见下方要点。"
    out = enrich_definitions(defs, title, raw, keys)
    if pid in DEF_OVERRIDES:
        ov = DEF_OVERRIDES[pid]
        if definition_text_len(out) < DEF_MIN_QUALITY:
            out = enrich_definitions(ov, title, raw, keys)
        elif authoritative_override(pid):
            out = enrich_definitions(ov, title, raw, keys)
        else:
            out = merge_definition_lines(ov, out, limit=14)
    out = supplement_missing_act(clean_definition_output(out), ch_num, title, raw)
    out = ensure_section_def_act(out, title)
    clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    out = filter_definitions_by_title(out, keys, clean)
    role_map = build_role_map_from_chapter(ch_text) if ch_text else {}
    out = normalize_definition_bullets(out)
    out = improve_definition_roles(out, role_map, clean)
    out = apply_role_map_to_definitions(out, role_map)
    out = purge_placeholder_defs(out)
    if pid.startswith("kp-论文专题") or pid == "kp-内容":
        clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
        return (
            f"- **{clean}**：是科三论文可选专题方向；{ESSAY_DEF_PREFIX.rstrip('。')}。"
            "**作用**：用于科三论文选题与摘要/正文三问结构对齐。"
        )
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


def build_essay_exam(title: str) -> str:
    clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()
    return "\n\n".join(
        [
            f"- **科三论文**：从本页「本组可选专题」择一（{clean}），**同一项目**贯穿摘要与正文三问。",
            "- **结构**：摘要约 300～320 字；正文按试题三问分段，各约 600～800 字，以「我」写角色与量化效果。",
            "- **自检**：三问分别作答、摘要与正文一致、术语准确；勿中途更换项目。",
            "- **速查**：[论文方向写作索引](../速查/论文方向写作索引.md)；方法见 [论文写作要点](/kb/kp-注意事项-解答步骤-摘要正文-评分)。",
        ]
    )


def build_exam(
    exam: str,
    tips: str,
    raw: str,
    keys: list[str],
    item: dict | None = None,
    bank: QuestionBankIndex | None = None,
    pid: str = "",
) -> str:
    if pid in EXAM_OVERRIDES:
        base = EXAM_OVERRIDES[pid]
        if bank and item:
            sup = bank.exam_supplement(item, keys)
            if sup:
                return f"{base}\n\n{sup}"
        return base
    if pid.startswith("kp-论文专题") and item:
        body = build_essay_exam(item.get("title") or "")
        if bank and item:
            sup = bank.exam_supplement(item, keys)
            if sup:
                body = f"{body}\n\n{sup}"
        return body
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
    body = "\n\n".join(parts)
    if len(body) < EXAM_MIN_QUALITY:
        extras: list[str] = []
        if ch and ch in CHAPTER_EXAM_HINT:
            extras.append(f"- **综合知识侧重**：{CHAPTER_EXAM_HINT[ch]}。")
        hint = POINT_EXAM_HINT.get(pid)
        if hint:
            extras.append(f"- **本考点侧重**：{hint}。")
        extras.append(
            "- **案例题**：先写业务/非功能约束，再列 2 方案对比，结论回扣本页定义术语。"
        )
        if ch != 22:
            extras.append(
                "- **论文题**：可复用近 3 年项目经历；结构见 "
                "[论文写作要点](/kb/kp-注意事项-解答步骤-摘要正文-评分)。"
            )
        parts.insert(0, "\n".join(extras))
    return "\n\n".join(parts)


def _def_bullet_label(line: str) -> str:
    m = re.match(r"^- \*\*(.+?)\*\*", line.strip())
    if not m:
        return ""
    return re.sub(r"（.+?）$", "", m.group(1)).strip()


def def_line_relevant(line: str, keys: list[str], title_clean: str) -> bool:
    if not line.strip().startswith("- "):
        return True
    label = _def_bullet_label(line)
    blob = line if not label else f"{label}\n{line}"
    for k in keys:
        if len(k) >= 2 and k in blob:
            return True
    if not label:
        return True
    if title_clean and (title_clean in label or label in title_clean):
        return True
    for m in re.finditer(r"[A-Z]{2,}", title_clean):
        if m.group(0) in label.upper():
            return True
    # 剔除典型串节（如生命周期页误收 UML）
    if "UML" in label.upper() and "UML" not in title_clean.upper():
        if not any("UML" in k.upper() for k in keys):
            return False
    return True


def filter_definitions_by_title(defs: str, keys: list[str], title_clean: str) -> str:
    lines = [ln for ln in defs.splitlines() if ln.strip()]
    kept = [ln for ln in lines if def_line_relevant(ln, keys, title_clean)]
    out = "\n".join(kept).strip()
    if len(out) >= 80 and _def_has_what(out):
        return out
    return defs.strip()


def first_definition_plain(defs: str, max_len: int = 200) -> str:
    for ln in defs.splitlines():
        if not ln.strip().startswith("- **"):
            continue
        plain = re.sub(r"\*\*", "", ln.lstrip("- ").strip())
        if len(plain) < 16:
            continue
        if max_len and len(plain) > max_len:
            plain = plain[: max_len - 1].rstrip("，,；;") + "…"
        return plain
    return ""


def extract_concrete_bullets(raw: str, keys: list[str], limit: int = 4) -> list[str]:
    out: list[str] = []
    for ln in raw.splitlines():
        t = ln.strip()
        if t.startswith("#") or t.startswith("```") or t.startswith(">"):
            continue
        if t.startswith("|") or "---" in t:
            continue
        if not (t.startswith("- ") or t.startswith("* ") or re.match(r"^\d+[.)]", t)):
            continue
        plain = re.sub(r"\*\*", "", t)
        plain = re.sub(r"^[-*]\s*", "", plain)
        plain = re.sub(r"^\d+[.)]\s*", "", plain).strip()
        if len(plain) < 14:
            continue
        if keys and not any(k in plain for k in keys[:8]):
            if not re.search(r"[0-9→—]|阶段|步骤|原则|对比|口诀", plain):
                continue
        if plain in out:
            continue
        out.append(plain[:220])
        if len(out) >= limit:
            break
    return out


def build_role_map_from_chapter(ch_text: str) -> dict[str, str]:
    mp: dict[str, str] = {}
    if not ch_text.strip():
        return mp
    pat = re.compile(
        r"####\s+(.+?)\s*\n+\*\*定义\*\*[：:]\s*.+?\n+\*\*作用\*\*[：:]\s*(.+?)(?=\n\n|\n#|\Z)",
        re.S,
    )
    for m in pat.finditer(ch_text):
        term = re.sub(r"（答卷）.*", "", m.group(1)).strip()
        act = m.group(2).strip().rstrip("。")
        if term and act and len(act) > 8:
            mp[term] = act
    pat2 = re.compile(
        r"\*\*(.+?)（答卷·定义）\*\*\s*\n+(.+?)\n+\*\*作用\*\*[：:]\s*(.+?)(?=\n\n|\n#|\Z)",
        re.S,
    )
    for m in pat2.finditer(ch_text):
        term = m.group(1).strip()
        act = m.group(3).strip().rstrip("。")
        if term and act:
            mp[term] = act
    for line in parse_chaptersubsubsection_defs(ch_text):
        m3 = re.match(r"- \*\*(.+?)\*\*：(.+)。\*\*作用\*\*：(.+)$", line.strip())
        if m3:
            term = m3.group(1).strip()
            act = m3.group(3).strip().rstrip("。")
            mp[term] = act
    return mp


def _match_role_act(label: str, role_map: dict[str, str]) -> str | None:
    if not label:
        return None
    exact = role_map.get(label)
    if exact:
        return exact
    candidates = [
        (term, act)
        for term, act in role_map.items()
        if label == term or (len(term) >= 4 and label.startswith(term))
    ]
    if not candidates:
        return None
    term, act = max(candidates, key=lambda x: len(x[0]))
    return act if label == term or label.startswith(term) else None


def clamp_definition_line(ln: str) -> str:
    ln = ln.strip()
    if not ln.startswith("- "):
        return ln
    m = re.search(r"(\*\*作用\*\*：[^。\n]+。)", ln)
    if m:
        head = ln[: m.end()]
        return re.sub(r"\s+", " ", head)
    if "。" in ln:
        return re.sub(r"\s+", " ", ln.split("。")[0] + "。")
    return ln


def normalize_definition_bullets(defs: str) -> str:
    out: list[str] = []
    for ln in defs.splitlines():
        if ln.strip().startswith("- **"):
            out.append(clamp_definition_line(ln))
        elif ln.strip() and out:
            continue
        elif ln.strip():
            out.append(ln.strip())
    return "\n".join(out).strip()


def apply_role_map_to_definitions(defs: str, role_map: dict[str, str]) -> str:
    if not role_map or not defs.strip():
        return defs
    out: list[str] = []
    for ln in defs.splitlines():
        if not ln.strip().startswith("- **"):
            continue
        label = _def_bullet_label(ln)
        act = _match_role_act(label, role_map)
        if act and "**作用**" in ln:
            ln = re.sub(r"\*\*作用\*\*：[^。]+。", f"**作用**：{act}。", ln.strip())
        out.append(ln)
    return "\n".join(out)


def improve_definition_roles(
    defs: str,
    role_map: dict[str, str],
    title_clean: str,
) -> str:
    if not defs.strip():
        return defs
    defs = normalize_definition_bullets(defs)
    out: list[str] = []
    for ln in defs.splitlines():
        if not GENERIC_ROLE_RE.search(ln.strip()):
            out.append(ln)
            continue
        label = _def_bullet_label(ln)
        act = _match_role_act(label, role_map)
        if act:
            ln = GENERIC_ROLE_RE.sub(f"**作用**：{act}。", ln.strip())
        elif label:
            ln = GENERIC_ROLE_RE.sub(
                f"**作用**：用于题干场景下的概念识别、对比选型与案例/论文回扣。",
                ln.strip(),
            )
        out.append(ln)
    return "\n".join(out)


def _section_relevant(head: str, body: str, keys: list[str]) -> bool:
    blob = f"{head}\n{body[:400]}"
    if any(w in head for w in ("步骤", "阶段", "活动", "流程", "过程")):
        return True
    if keys and any(k in blob for k in keys if len(k) >= 2):
        return True
    return False


def _step_text_usable(text: str) -> bool:
    t = text.strip()
    if len(t) < 6:
        return False
    if t.startswith("|"):
        return False
    if re.match(r"^[：:\s]", t):
        return False
    core = re.sub(r"[\W_：:、，。；;（）()\[\]【】\-—\s]", "", t)
    return len(core) >= 4


def extract_flow_chains(body: str, max_items: int = 8) -> list[str]:
    chains: list[str] = []
    seen: set[str] = set()
    for m in re.finditer(
        r"(?:流程|步骤|阶段|过程|链路)[：:]\s*([^\n。]+(?:→[^\n。]+)+)",
        body,
    ):
        chain = re.sub(r"\*\*", "", m.group(1).strip())
        if len(chain) > 14 and chain not in seen:
            seen.add(chain)
            chains.append(chain)
    for line in body.splitlines():
        if "→" not in line:
            continue
        cleaned = re.sub(r"^[-*•\d.)]+\s*", "", line.strip())
        cleaned = re.sub(r"\*\*", "", cleaned)
        cleaned = re.sub(r"^[^：:]{0,24}[：:]\s*", "", cleaned)
        if cleaned.count("→") >= 2 and len(cleaned) > 16 and cleaned not in seen:
            seen.add(cleaned)
            chains.append(cleaned)
    return chains[:max_items]


def extract_numbered_steps(body: str, max_items: int = 14) -> list[str]:
    steps: list[str] = []
    for m in re.finditer(r"(?m)^(\d+)[.)]\s*(.+)$", body):
        text = m.group(2).strip()
        if not _step_text_usable(text):
            continue
        steps.append(text)
    if not steps:
        for chain in extract_flow_chains(body, max_items):
            parts = [p.strip() for p in re.split(r"\s*→\s*", chain) if p.strip()]
            if len(parts) >= 2:
                steps.extend(parts)
    if not steps:
        for m in re.finditer(r"(\*\*[^*]+\*\*[^。\n]{0,40}→[^。\n]+)", body):
            chain = m.group(1).strip()
            if len(chain) > 12:
                steps.append(re.sub(r"\*\*", "", chain))
    return steps[:max_items]


def _procedure_harvest_usable(text: str) -> bool:
    body = text.strip()
    if len(re.sub(r"\s", "", body)) < 80:
        return False
    bad = re.findall(r"(?m)^\d+\.\s*[：:]\s*$", body)
    if bad:
        return False
    steps = re.findall(r"(?m)^\d+\.\s*(.+)$", body)
    good = [s for s in steps if _step_text_usable(s)]
    chains = extract_flow_chains(body, 4)
    return len(good) >= 2 or bool(chains) or len(body) >= 160


def harvest_procedure_blocks(
    ch_text: str,
    keys: list[str],
    raw: str,
    ch_num: int | None,
    outline_ref: str | None,
    pid: str,
) -> str:
    packs: list[tuple[float, str]] = []
    for head, body in atomic_sections(ch_text):
        if not _section_relevant(head, body, keys):
            continue
        sc = score_item(pid, keys, head, body, outline_ref, ch_num)
        steps = extract_numbered_steps(body)
        if not steps:
            continue
        tail = head.split("/")[-1].strip()
        if tail.startswith("#"):
            tail = tail.lstrip("#").strip()
        block = f"### {tail}\n\n" + "\n".join(
            f"{i}. {s.rstrip('。')}" for i, s in enumerate(steps, 1)
        )
        packs.append((sc + len(steps) * 2, block))
    packs.sort(key=lambda x: -x[0])
    if packs:
        merged = "\n\n".join(b for _, b in packs[:3])
        if _procedure_harvest_usable(merged):
            return merged
    # raw 要点中的流程链与编号列表
    raw_chains = extract_flow_chains(raw, 4)
    if raw_chains:
        blocks = ["### 流程要点\n\n" + c for c in raw_chains[:2]]
        merged = "\n\n".join(blocks)
        if _procedure_harvest_usable(merged):
            return merged
    raw_steps = extract_numbered_steps(raw)
    if raw_steps:
        block = "### 流程要点\n\n" + "\n".join(
            f"{i}. {s.rstrip('。')}" for i, s in enumerate(raw_steps[:12], 1)
        )
        if _procedure_harvest_usable(block):
            return block
    return ""


def build_steps_section(
    pid: str,
    keys: list[str],
    raw: str,
    ch_text: str,
    ch_num: int | None,
    outline_ref: str | None,
) -> str:
    if pid.startswith("kp-论文专题"):
        return ESSAY_PROCEDURE
    if pid in PROCEDURE_OVERRIDES:
        return PROCEDURE_OVERRIDES[pid]
    harvested = harvest_procedure_blocks(
        ch_text, keys, raw, ch_num, outline_ref, pid
    )
    if harvested.strip() and _procedure_harvest_usable(harvested):
        return harvested
    return (
        "本节在教程中**未单独列出固定步骤名**；答题时可按下列指引组织答案：\n"
        "1. 先在「要点」中找 **阶段 / 活动 / → 流程链** 表述；\n"
        "2. 案例题常用 **调查 → 分析 → 方案 → 验证**（或题干给出的过程框架）；\n"
        "3. 综合知识流程题优先写 **编号步骤** 或 **阶段名称**；\n"
        "4. 需要完整步骤时打开文末 **归档通章** 对应小节对照誊写。"
    )


def build_quick_grasp(
    title_clean: str,
    overview: str,
    defs: str,
    raw: str,
    mix_out: str,
    keys: list[str],
    ch_num: int | None,
    pid: str = "",
) -> str:
    one = first_definition_plain(defs)
    if not one:
        one = re.sub(r"\*\*", "", overview).strip()
    exam_hint = POINT_EXAM_HINT.get(pid) or CHAPTER_EXAM_HINT.get(
        ch_num or 0, "概念辨析、场景决策与案例回扣"
    )
    ch_note = f"（教程第 {ch_num} 章）" if ch_num else ""
    bullets = extract_concrete_bullets(raw, keys, 4)
    if len(bullets) < 2:
        bullets.extend(extract_concrete_bullets(defs, keys, 4 - len(bullets)))
    confuse = ""
    if mix_out.strip() and not mix_out.strip().startswith("（"):
        confuse = re.sub(r"\*\*", "", mix_out.splitlines()[0])[:140]
    elif keys:
        confuse = f"与同章相邻考点区分；题干锚词：**{' / '.join(keys[:3])}**。"
    else:
        confuse = "先读定义完整句，再对照下方要点与易混辨析。"
    lines = [
        f"- **一句话**：{one}",
        f"- **考什么**：{exam_hint}{ch_note}。",
        "- **具体理解**：",
    ]
    if bullets:
        for b in bullets[:4]:
            lines.append(f"  - {b}")
    else:
        lines.append("  - 先背定义节「是什么 + 作用」，再展开要点中的表格或口诀。")
    lines.append(f"- **别搞混**：{confuse}")
    return "\n".join(lines)


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
        if p.count("- **") >= 2 or p.count("。") > 6:
            continue
        if re.match(r"^\*\*.+\*\*[：:]\s*$", p):
            continue
        if re.match(r"^(?:\*\*)?统计(?:\*\*)?[：:]", p):
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


def scrub_points_answer_blocks(body: str) -> str:
    return re.sub(
        r"\*\*.+?（答卷·(?:定义|必背|作用)）\*\*[^\n]*\n(?:[^\n#][^\n]*\n?)*",
        "",
        body,
    )


def scrub_points_def_dupes(body: str, defs: str) -> str:
    for ln in defs.splitlines():
        s = ln.strip()
        if not s.startswith("- "):
            continue
        label = s[2:].split("：", 1)[0].split(":", 1)[0].strip()
        if len(label) < 3:
            continue
        esc_label = re.escape(label)
        body = re.sub(rf"^- {esc_label}\s*[：:].*\n?", "", body, flags=re.M)
        inner = label.replace("**", "")
        if inner and inner != label:
            body = re.sub(
                rf"^- \*\*{re.escape(inner)}\*\*\s*[：:].*\n?",
                "",
                body,
                flags=re.M,
            )
    body = re.sub(r"^- \*\*\*\*\s*[：:].*$", "", body, flags=re.M)
    return body


def scrub_points(raw: str, defs: str) -> str:
    body = scrub_points_answer_blocks(raw)
    deduped = scrub_points_def_dupes(body, defs)
    if len(deduped.strip()) >= RAW_MIN_QUALITY:
        body = deduped
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
    pid = item.get("id", "")
    g = item.get("group") or ""
    sibs = sorted(by_group.get(g, []), key=lambda x: x.get("outlineRef") or "")
    idx = next((i for i, s in enumerate(sibs) if s["id"] == item["id"]), -1)
    lines: list[str] = []
    seen: set[str] = {pid}
    for rid in RELATED_OVERRIDES.get(pid, []):
        if rid in seen:
            continue
        seen.add(rid)
        hit = next((s for s in sibs if s["id"] == rid), None)
        if not hit:
            for lst in by_group.values():
                hit = next((s for s in lst if s["id"] == rid), None)
                if hit:
                    break
        if hit:
            st = re.sub(r"^\d+(?:\.\d+)*\s*", "", hit.get("title", ""))[:48]
            lines.append(f"- [{st}](/kb/{rid})")
    for j in (idx - 1, idx + 1):
        if 0 <= j < len(sibs):
            s = sibs[j]
            if s["id"] in seen:
                continue
            seen.add(s["id"])
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
    defs = finalize_definitions(
        pid, raw, title, keys, ch_text, ch_num, item.get("outlineRef")
    )
    points = scrub_points(raw, defs)
    mix_out = filter_mix(mix, keys)
    quick = build_quick_grasp(
        re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip(),
        overview,
        defs,
        raw,
        mix_out,
        keys,
        ch_num,
        pid,
    )
    steps = build_steps_section(
        pid, keys, raw, ch_text, ch_num, item.get("outlineRef")
    )
    exam_out = build_exam(exam, tips, raw, keys, item, bank, pid)
    rel = related_links(item, by_group)
    return f"""# {h1}

> **大纲**：{ref} · **教程**：{ch_line} · **分组**：{group} · **状态**：{POLISH_STATUS}

## 概述

{overview}

## 速懂

{quick}

## 定义

{defs}

## 步骤与流程

{steps}

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
        elif pid in SYNTHETIC_ONLY:
            raw = SYNTHETIC_POINTS.get(pid, "")
        else:
            raw = force_extract(pid) or special_raw(pid) or slices.get(pid, "")

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
        if not raw.strip() and authoritative_override(pid):
            raw = DEF_OVERRIDES[pid]
        if not raw.strip():
            continue
        doc = render(it, raw, ch_text, by_group, bank)
        if not args.dry_run:
            (POINTS / f"{pid}.md").write_text(doc, encoding="utf-8")
        it["status"] = "正式"
        it["note"] = "审计通过 v1.3.4-api"
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
        meta["version"] = "v1.3.4-api"
        meta["apiPolish"] = "2026-09-26"
        meta["authoringGuide"] = "docs/kb-workshop/编制委员会/答卷写法准则-v1.1.md"
        INDEX.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print({"refined": n, "skipped_manual": len(SKIP_IDS), "dry_run": args.dry_run})


if __name__ == "__main__":
    main()
