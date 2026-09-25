"""为案例生成《案例分析答题教程》单题 7 步法。

练习题与真题共用本模块。
"""
from __future__ import annotations

import re

STEP_META = [
    ("① 先看问题", "先明确要答什么，再读案例，避免平均用力。"),
    ("② 通读案例，圈约束", "阅卷看你是否用到题干约束；每问至少回扣 2 个题干词。"),
    ("③ 判断领域与题型", "题型对了才套对模板；领域对了才想起正确的信号→对策。"),
    ("④ 列提纲/表格骨架", "先结构后内容，保证对比维/编号/措施条数不丢。"),
    ("⑤ 按问作答，先写采分点", "得分靠踩点与权衡，不靠散文与堆砌名词。"),
    ("⑥ 回扣题干关键词检查", "专治「空对空」：大段定义却不碰案例事实。"),
    ("⑦ 字数与卷面", "填空写满、表填满、限字留结构；版式便于阅卷找点。"),
]

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

SIGNALS = [
    ("不能停机|禁止.*停机|不可长时间停机|不允许长时间停机", "不可长时间停机 / 须可灰度并行"),
    ("灰度|回滚", "可灰度 / 可回滚"),
    ("峰值|大促|高并发", "峰值 / 大促承载"),
    ("缓存|限流", "缓存与限流"),
    ("击穿|穿透", "缓存击穿 / 穿透风险"),
    ("干系人", "干系人多 / 冲突"),
    ("工期|预算", "固定工期 / 预算"),
    ("接口|SAP|ERP|MES|遗留", "接口 / 遗留系统边界"),
    ("幂等", "须幂等"),
    ("熔断|雪崩", "故障隔离 / 防雪崩"),
    ("弱网", "弱网场景"),
    ("审核|热更新", "发布 / 审核约束"),
    ("优先级反转|硬实时|实时性|最坏执行", "实时 / 调度约束"),
    ("强一致|最终一致", "一致性取舍"),
    ("需求获取|访谈|JRP|问卷", "需求获取方法须对号入座"),
    ("可行性", "须按可行性维度作答（经济/技术/法律/用户）"),
    ("净现值|现金流|投资", "含计算：公式先行、代入题干数字"),
]

KEYWORDS = [
    "ERP", "SAP", "MES", "缓存", "限流", "灰度", "停机", "幂等", "熔断",
    "干系人", "MVP", "原型", "BFF", "网关", "优先级", "弱网", "审核",
    "击穿", "穿透", "对账", "契约", "JRP", "DFD", "用例", "可行性",
    "净现值", "UML", "MVC", "微服务", "嵌入式", "数据库", "分片",
]


def _clean(text: str) -> str:
    text = re.sub(r"!\[.*?\]\([^)]+\)", "", text or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def classify_prompt(prompt: str) -> tuple[str, str]:
    p = _clean(prompt)
    if any(k in p for k in ("计算", "净现值", "公式", "请计算")):
        return "计算", "公式写清 → 代入题干数字 → 单位与结论（哪种最优）"
    if any(k in p for k in ("填空", "完善图", "补充图", "空（", "(1)", "（1）", "填表")):
        return "填空", "先看已有格子的命名风格，再按上下游关系填教材标准词"
    if any(k in p for k in ("比较", "对比", "优缺点", "优势", "区别")):
        return "对比", "先表后文：维度从本问/题干来，最后写「更符合哪条约束」"
    if any(k in p for k in ("改进", "优化", "措施", "如何保证", "如何实现", "建议")):
        return "设计", "目标 → 措施（机制+落点+解决什么）→ 可选验证方式"
    if any(k in p for k in ("指出", "存在的问题", "错误")):
        return "分析", "先结论/问题清单（编号），每条挂钩题干现状一句"
    limit = ""
    m = re.search(r"(\d+)\s*字以内", p)
    if m:
        limit = f"（≤{m.group(1)}字：先结论后要点）"
    return "简答", f"三段式：结论 → 要点编号 → 回扣题干{limit}"


def extract_constraints(stem: str, prompts: list[str]) -> list[str]:
    blob_all = stem + "\n" + "\n".join(prompts)
    items: list[str] = []
    for m in re.finditer(r"[（(](\d+)[）)]\s*([^（(\n]{6,80})", stem):
        items.append(m.group(0).strip())
        if len(items) >= 4:
            break
    blob = "；".join(items)
    for pat, label in SIGNALS:
        if re.search(pat, blob_all) and not re.search(pat, blob):
            items.append(label)
    if "王工" in blob_all and "李工" in blob_all:
        items.append("存在王工/李工两套候选方案，须对比后选型")
    seen: set[str] = set()
    uniq: list[str] = []
    for c in items:
        key = re.sub(r"\s+", "", c)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)
    return uniq[:8] or ["通读题干，标出业务目标、质量属性、技术现状、组织约束、明确要求"]


def build_seven_steps(
    *,
    case_id: str,
    domain: str,
    case_type: str,
    stem: str,
    questions: list[dict],
    pack_role: str,
) -> list[dict]:
    prompts = [(int(q.get("qnum") or i + 1), str(q.get("prompt") or "")) for i, q in enumerate(questions)]
    kinds: list[str] = []
    q_lines: list[str] = []
    score_bits: list[str] = []
    outline_bits: list[str] = []
    for n, p in prompts:
        kind, skeleton = classify_prompt(p)
        kinds.append(kind)
        short = _clean(p)
        if len(short) > 110:
            short = short[:110] + "…"
        limit = ""
        m = re.search(r"(\d+)\s*字以内", p)
        if m:
            limit = f"【限{m.group(1)}字】"
        q_lines.append(f"- 问题{n}（{kind}）{limit}：{short}")
        outline_bits.append(f"- 问题{n}：{skeleton}")
        sample = ""
        qobj = next((q for q in questions if int(q.get("qnum") or 0) == n), None)
        if qobj:
            sample = _clean(str((qobj.get("rubric") or {}).get("sample") or ""))
        if sample and sample not in {"见解析", "（参考答案待补）"} and len(sample) > 12:
            tip = sample[:90] + ("…" if len(sample) > 90 else "")
            score_bits.append(f"- 问题{n}：对照解析先落这些点——{tip}")
        else:
            score_bits.append(f"- 问题{n}：按「{kind}」先写采分机制，再回扣题干；不要只默写定义")

    constraints = extract_constraints(stem, [p for _, p in prompts])
    c_lines = "\n".join(f"- {c}" for c in constraints)

    kws = [kw for kw in KEYWORDS if kw in stem or any(kw in p for _, p in prompts)]
    kw_line = "、".join(kws[:10]) if kws else "题干专有名词（系统名、方法名、质量属性）"

    fmt_bits: list[str] = []
    if "对比" in kinds:
        fmt_bits.append("对比问：表内短词，表下 2–4 句结论")
    if "填空" in kinds:
        fmt_bits.append("填空/补图：空写满，风格对齐已有格")
    if "计算" in kinds:
        fmt_bits.append("计算问：过程写全，单位与最优结论不要漏")
    if any(re.search(r"\d+\s*字以内", p) for _, p in prompts):
        fmt_bits.append("限字问：砍修饰留结构，先结论后要点")
    fmt_bits.append("简答：用（1）（2）（3）编号")
    fmt_bits.append("交卷前确认每问都出现题干词")

    ch = CHAPTER_MAP.get(domain, 16)
    kind_summary = " / ".join(dict.fromkeys(kinds)) or case_type

    hows = [
        f"本套角色：{pack_role}。\n先只看问题清单（约 30 秒），记下题型与限字：\n" + "\n".join(q_lines),
        f"通读题干【说明】，在草稿纸圈出约束（本案例优先关注）：\n{c_lines}\n答每一问前扫一眼本清单。",
        f"领域：**{domain}**（教程第{ch}章相关）。\n按各问判定：{kind_summary}。模板见答题教程 §3（对比/填空/简答/设计/计算）。",
        "先花约 2 分钟只写骨架，不写长文：\n" + "\n".join(outline_bits),
        "按问作答，优先落下采分点：\n"
        + "\n".join(score_bits)
        + "\n心中过三问：业务问题？质量属性排序？约束下最优（而非理论上最优）？",
        f"写完自检：\n- 是否出现关键词：{kw_line}\n- 每条是否像独立采分点（有机制，非「更好/更强」）\n- 限字是否超标；计算过程与单位是否写清",
        "卷面收尾：\n- " + "\n- ".join(fmt_bits),
    ]

    return [{"title": title, "how": how, "why": why} for (title, why), how in zip(STEP_META, hows)]
