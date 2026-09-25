"""案例分析真题 · 领域与章节推断（避免「核心需求」等泛词误标为需求工程）。"""
from __future__ import annotations

import re

CHAPTER_MAP = {
    "系统规划": 10,
    "需求": 11,
    "Web": 16,
    "移动": 18,
    "微服务": 20,
    "大数据": 19,
    "嵌入式": 17,
    "CPS": 21,
    "集成": 12,
    "架构": 12,
    "数据库": 5,
    "测试": 14,
    "安全": 9,
    "运维": 15,
    "项目管理": 8,
}

# 「阅读以下关于…」标题片段 → 领域（按优先级）
TOPIC_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"系统规划|ERP系统规划|可行性分析|软件系统可行性"), "系统规划"),
    (re.compile(r"数据库|数据管理|数据存储|数据分区|反规范化|ORM|Redis|NoSQL"), "数据库"),
    (re.compile(r"嵌入式|多核|实时系统|机器人"), "嵌入式"),
    (re.compile(r"微服务|服务网格|容器云"), "微服务"),
    (re.compile(r"大数据|数据仓库|Hadoop|Spark|用户行为分析"), "大数据"),
    (re.compile(r"用例测试|软件测试|测试"), "测试"),
    (re.compile(r"需求分析|需求获取|需求工程|DFD|数据流图"), "需求"),
    (re.compile(r"Web应用|Web系统|AI智能体|智能体平台|Web.*AI|电子商务|在线销售|前后端|区块链|社交网络|SNS|智慧管理|气象"), "Web"),
    (re.compile(r"排队叫号|停车场|预约系统|在线调查|客户关系|CRM"), "Web"),
    (re.compile(r"系统集成|中间件|遗留系统|EAI|ESB"), "集成"),
    (re.compile(r"网络设计|物理网络|信息安全|加密|容灾"), "安全"),
    (re.compile(r"PERT|挣值|WBS|项目管理"), "项目管理"),
    (re.compile(r"面向对象.*设计|系统架构|MDA|SOA"), "架构"),
]

# 全篇计分（不含单独「需求」二字，避免 NFR 列表误伤）
SCORE_RULES: list[tuple[re.Pattern[str], str, int]] = [
    (re.compile(r"用例图|识别.*参与者|核心用例|用例描述|用例测试", re.I), "需求", 5),
    (
        re.compile(
            r"软件系统可行性|ERP系统规划|项目论证会|净现值|NPVR|NPV|投资回收|现金流量",
            re.I,
        ),
        "系统规划",
        6,
    ),
    (re.compile(r"可行性分析", re.I), "系统规划", 5),
    (
        re.compile(r"经济可行性|技术可行性|法律可行性|用户使用可行性", re.I),
        "系统规划",
        3,
    ),
    (re.compile(r"数据流图|活动图和流程图|DFD|需求获取|需求工程|JRP|FAST", re.I), "需求", 5),
    (re.compile(r"数据库|MySQL|NoSQL|Redis|分片|3NF|范式|反规范化|读写分离|主从|索引|视图|物理分区|缓存穿透|布隆过滤器|哨兵|InnoDB|MongoDB|HBase|键值|列式", re.I), "数据库", 3),
    (re.compile(r"嵌入式|多核|RTOS|硬实时|优先级反转|分区化技术|操作系统架构", re.I), "嵌入式", 4),
    (re.compile(r"微服务|Kubernetes|Docker|服务注册|网络约车", re.I), "微服务", 3),
    (re.compile(r"区块链|去中心化|SNS|社交网络", re.I), "Web", 4),
    (re.compile(r"Web应用|基于Web|Web系统|AI智能体|智能体|负载均衡|Spring Cloud|FastAPI|前后端分离|MVP|MVVM|浏览器|HTTP|电商|商城|云数据库", re.I), "Web", 3),
    (re.compile(r"测试用例|集成测试|验收测试|V模型|Alpha|Beta", re.I), "测试", 2),
    (re.compile(r"大数据|MapReduce|Spark|PV/UV|海量.*数据", re.I), "大数据", 2),
    (re.compile(r"PERT|挣值|EVM|关键路径", re.I), "项目管理", 2),
    (re.compile(r"遗留系统|中间件|ESB|EAI", re.I), "集成", 2),
]


def _extract_about_topic(blob: str) -> str:
    m = re.search(
        r"阅读以下关于(.{2,48}?)(?:的叙述|的描述|，|。)",
        blob,
        re.S,
    )
    if m:
        return re.sub(r"\s+", "", m.group(1))
    m = re.search(r"关于(.{2,40}?)(?:系统|平台|技术)", blob)
    if m:
        return re.sub(r"\s+", "", m.group(1))
    return ""


def infer_case_domain(
    stem: str,
    point: str = "",
    prompts: list[str] | None = None,
    case_id: str = "",
) -> tuple[int, str]:
    """返回 (chapter, domain)。"""
    if case_id and case_id in CASE_DOMAIN_OVERRIDES:
        ch, domain = CASE_DOMAIN_OVERRIDES[case_id]
        return ch, domain

    prompts = prompts or []
    blob = f"{stem}\n{point}\n" + "\n".join(prompts)

    topic = _extract_about_topic(blob)
    if topic:
        for pat, domain in TOPIC_PATTERNS:
            if pat.search(topic):
                return CHAPTER_MAP[domain], domain

    scores: dict[str, int] = {}
    for pat, domain, weight in SCORE_RULES:
        hits = pat.findall(blob)
        if hits:
            scores[domain] = scores.get(domain, 0) + weight * len(hits)

    if scores:
        domain = max(scores.items(), key=lambda x: x[1])[0]
        return CHAPTER_MAP[domain], domain

    if re.search(r"Web|web", blob):
        return 16, "Web"
    return 16, "Web"


# 人工兜底（推断仍歧义时）
CASE_DOMAIN_OVERRIDES: dict[str, tuple[int, str]] = {
    "ZT-2021上-案例01": (11, "需求"),  # FAST 问题/需求/决策分析，非立项可行性专题
    "ZT-2018上-案例05": (11, "需求"),  # 在线调查：业务流程 / 补图
    "ZT-2021上-案例04": (16, "Web"),  # 远程康复 Web 架构 + 云库选型
    "ZT-2020上-案例01": (11, "需求"),  # 用例详述 + 实体/控制/接口对象
    "ZT-2026上-案例05": (16, "Web"),  # Web + AI 智能体：架构选型 / 负载均衡
}


def infer_case_type(stem: str) -> str:
    blob = stem or ""
    if any(x in blob for x in ("比较", "对比", "两种方案", "王工", "李工")):
        return "方案对比"
    if any(x in blob for x in ("填", "完善", "补充", "空（", "(1)")):
        return "架构设计"
    if any(x in blob for x in ("改进", "问题", "错误", "优化")):
        return "分析改进"
    return "分析改进"
