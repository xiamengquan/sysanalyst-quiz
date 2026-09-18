#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为五选三 pack 中的案例 MD 追加「## 七步法」专节（已有则覆盖）。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CASE_DIR = ROOT / "content/banks/cases"
PACK = CASE_DIR / "packs/wuxuan-san.json"

STEP_META = [
    ("① 先看问题", "先明确要答什么，再读案例，避免平均用力。"),
    ("② 通读案例，圈约束", "阅卷看你是否用到题干约束；每问至少回扣 2 个题干词。"),
    ("③ 判断领域与题型", "题型对了才套对模板；领域对了才想起正确的信号→对策。"),
    ("④ 列提纲/表格骨架", "先结构后内容，保证对比维/编号/措施条数不丢。"),
    ("⑤ 按问作答，先写采分点", "得分靠踩点与权衡，不靠散文与堆砌名词。"),
    ("⑥ 回扣题干关键词检查", "专治「空对空」：大段定义却不碰案例事实。"),
    ("⑦ 字数与卷面", "填空写满、表填满、限字留结构；版式便于阅卷找点。"),
]

TYPE_OUTLINE = {
    "方案对比": (
        "问题1 先画对比表骨架（题干给定维度作表头）；"
        "问题2 先写结论（宜选谁）再写「结合题干××」；"
        "问题3 列风险→应对，不少于 3 条且可操作。"
    ),
    "分析改进": (
        "问题1 先列「现状推出的问题」编号清单；"
        "问题2 措施与问题一一对应（措施→解决哪条）；"
        "问题3 给可观测指标 ≥3（率/延迟/积压/错误码等）。"
    ),
    "架构设计": (
        "问题1 先写分层/构件清单（层名：职责）；"
        "问题2 措施写「机制 + 作用点 + 对应哪条质量属性」；"
        "问题3 接口要点落到具体层（网关/服务/适配器）。"
    ),
}


def section(text: str, name: str) -> str:
    pat = rf"##\s*{re.escape(name)}\s*\n(.*?)(?=\n##\s|\Z)"
    sm = re.search(pat, text, re.S)
    return (sm.group(1).strip() if sm else "")


def strip_seven(text: str) -> str:
    return re.sub(r"\n##\s*七步法\s*\n.*\Z", "\n", text, flags=re.S).rstrip() + "\n"


def extract_constraints(stem: str) -> list[str]:
    items: list[str] = []
    for m in re.finditer(r"补充约束[：:](.+?)(?=\n\n|\Z)", stem, re.S):
        chunk = m.group(1).strip()
        for part in re.split(r"[；;。\n]", chunk):
            p = part.strip(" 、，,")
            if len(p) >= 4:
                items.append(p)

    signals = [
        ("不能停机|禁止.*停机|不可长时间停机|不允许长时间停机", "不可长时间停机 / 须可灰度并行"),
        ("灰度|回滚", "可灰度 / 可回滚"),
        ("峰值|大促|高并发", "峰值 / 大促承载"),
        ("缓存|限流", "缓存与限流"),
        ("击穿|穿透", "缓存击穿 / 穿透风险"),
        ("干系人", "干系人多 / 冲突"),
        ("模糊|好用|先进", "目标模糊"),
        ("工期|预算", "固定工期 / 预算"),
        ("接口|SAP|ERP|MES", "接口 / 遗留系统边界"),
        ("幂等", "须幂等"),
        ("熔断|雪崩", "故障隔离 / 防雪崩"),
        ("弱网", "弱网场景"),
        ("审核|热更新", "发布 / 审核约束"),
        ("优先级反转|硬实时|实时性|最坏执行", "实时 / 调度约束"),
        ("强一致|最终一致", "一致性取舍"),
    ]
    blob = "；".join(items)
    for pat, label in signals:
        if re.search(pat, stem) and not re.search(pat, blob):
            items.append(label)
    if "王工" in stem and "李工" in stem:
        items.append("存在王工/李工两套候选方案，须对比后选型")

    seen: set[str] = set()
    uniq: list[str] = []
    for c in items:
        key = re.sub(r"\s+", "", c)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)
    return uniq[:8] or ["（通读题干，标出业务目标、质量属性、技术现状、组织约束、明确要求）"]


def extract_questions(qblock: str) -> list[tuple[int, str]]:
    prompts = re.findall(r"\*\*问题(\d+)\*\*\s*(.+?)(?=\n\*\*问题|\Z)", qblock, re.S)
    return [(int(n), p.strip().replace("\n", " ")) for n, p in prompts]


def type_label(case_type: str) -> str:
    mapping = {
        "方案对比": "类型 A · 方案对比/选型（先表后文，最后回扣约束选型）",
        "分析改进": "类型 D · 设计/改进（问题→措施→验证指标）",
        "架构设计": "类型 D · 架构设计（分层职责 + 质量属性措施 + 接口要点）",
    }
    return mapping.get(case_type, f"按「{case_type}」套答题教程模板")


def build_seven_md(
    *,
    no: int,
    domain: str,
    case_type: str,
    stem: str,
    questions: list[tuple[int, str]],
    rubrics: dict[int, str],
    pack_role: str,
) -> str:
    q_lines = "\n".join(f"- 问题{n}：{p[:120]}{'…' if len(p) > 120 else ''}" for n, p in questions)
    constraints = extract_constraints(stem)
    c_lines = "\n".join(f"- {c}" for c in constraints)

    # step5: per-question scoring guide from rubric first sentence
    score_bits = []
    for n, _ in questions:
        sample = rubrics.get(n, "")
        tip = sample.split("。")[0].strip() if sample else "先写可能采分的机制/维度词，再补一句题干回扣"
        if len(tip) > 100:
            tip = tip[:100] + "…"
        score_bits.append(f"- 问题{n}：{tip}")

    # keywords to check
    kws = []
    for kw in [
        "ERP", "SAP", "MES", "缓存", "限流", "灰度", "停机", "幂等", "熔断",
        "干系人", "MVP", "原型", "BFF", "网关", "优先级", "弱网", "审核",
        "击穿", "穿透", "对账", "契约",
    ]:
        if kw in stem or any(kw in p for _, p in questions):
            kws.append(kw)
    kw_line = "、".join(kws[:10]) if kws else "题干专有名词（遗留系统、峰值、接口名等）"

    has_200 = any("200字" in p for _, p in questions)
    has_table = any("列表" in p or "维度" in p or "比较" in p for _, p in questions)
    fmt_bits = []
    if has_table:
        fmt_bits.append("对比题：表内短词，表下 2–4 句结论")
    if has_200:
        fmt_bits.append("限字题：约 4–6 短句，砍修饰留结构")
    fmt_bits.append("简答/措施：用（1）（2）（3）编号")
    fmt_bits.append("交卷前确认表/空已填满")

    outline = TYPE_OUTLINE.get(case_type, "按问题编号列骨架；每问先结论后展开。")

    chapter_map = {
        "需求": 11,
        "Web": 16,
        "移动": 18,
        "微服务": 20,
        "大数据": 19,
        "嵌入式": 17,
        "CPS": 21,
        "集成": 12,
    }
    ch = chapter_map.get(domain, 16)

    hows = [
        f"本套角色：{pack_role}。\n先只看问题清单（约 30 秒），记下题型与硬性要求：\n{q_lines}",
        f"通读题干，在草稿纸圈出下列约束（本案例优先关注）：\n{c_lines}\n答每一问前扫一眼本清单。",
        f"领域：**{domain}**（教程第{ch}章相关）。\n题型判定：{type_label(case_type)}。",
        f"先花约 2 分钟只写骨架，不写长文：\n{outline}",
        f"按问作答，优先落下采分点（可对照下列方向，非唯一答案）：\n" + "\n".join(score_bits)
        + "\n心中过三问：业务问题？质量属性排序？约束下最优（而非理论上最优）？",
        f"写完自检：\n- 是否出现关键词：{kw_line}\n- 每条是否像独立采分点（有机制，非「更好/更强」）\n- 限字是否超标；选型是否点名题干约束",
        "卷面收尾：\n- " + "\n- ".join(fmt_bits),
    ]

    lines = ["## 七步法", "", f"> 依据《案例分析答题教程》§2.1；针对本案例（CA-{no:03d}）的做题路径。", ""]
    for (title, why), how in zip(STEP_META, hows):
        lines.append(f"### {title}")
        lines.append("")
        lines.append(f"**怎么做：** {how}")
        lines.append("")
        lines.append(f"**为什么：** {why}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def parse_header(text: str) -> tuple[int, str, str]:
    m = re.match(r"#\s*案例(\d+)\s*·\s*(.+?)\s*·\s*(.+)\s*$", text.splitlines()[0].strip())
    if not m:
        raise ValueError("bad title")
    return int(m.group(1)), m.group(2).strip(), m.group(3).strip()


def extract_rubrics(rblock: str) -> dict[int, str]:
    rubrics = re.findall(r"\*\*问题(\d+)要点[：:]\*\*\s*(.+?)(?=\n\*\*问题|\n\*\*领域|\Z)", rblock, re.S)
    return {int(n): t.strip() for n, t in rubrics}


def main() -> None:
    pack_data = json.loads(PACK.read_text(encoding="utf-8"))
    roles: dict[str, str] = {}
    for pack in pack_data["packs"]:
        cases = pack["cases"]
        for i, cid in enumerate(cases):
            if cid in roles:
                continue
            if i == 0:
                roles[cid] = f"{pack['id']} · 建议必答（试题一）"
            else:
                hint = pack.get("select_hint") or "优先 Web/移动/微服务/集成"
                roles[cid] = f"{pack['id']} · 选答候选；选题提示：{hint}"

    ids = []
    for pack in pack_data["packs"]:
        ids.extend(pack["cases"])
    ids = list(dict.fromkeys(ids))

    updated = []
    for cid in ids:
        no = int(cid.split("-")[1])
        path = CASE_DIR / f"案例{no:03d}.md"
        text = path.read_text(encoding="utf-8")
        no_h, domain, case_type = parse_header(text)
        stem = section(text, "题干")
        qblock = section(text, "问题")
        rblock = section(text, "参考作答要点（非唯一答案）") or section(text, "参考作答要点")
        questions = extract_questions(qblock)
        rubrics = extract_rubrics(rblock)
        seven = build_seven_md(
            no=no_h,
            domain=domain,
            case_type=case_type,
            stem=stem,
            questions=questions,
            rubrics=rubrics,
            pack_role=roles.get(cid, "五选三模拟"),
        )
        base = strip_seven(text)
        # insert after 参考作答要点 section (end of file after strip)
        new_text = base.rstrip() + "\n\n" + seven
        path.write_text(new_text, encoding="utf-8")
        updated.append(cid)

    print({"updated": len(updated), "ids": updated})


if __name__ == "__main__":
    main()
