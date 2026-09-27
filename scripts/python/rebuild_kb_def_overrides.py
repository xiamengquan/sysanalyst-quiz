#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用精修 finalize 重建 kb_def_overrides（去重、禁止从脏 md 快照导入）。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bootstrap_kb_def_overrides as boot  # noqa: E402
import refine_kb_api_points as r  # noqa: E402

OV_PATH = Path(__file__).resolve().parent / "kb_def_overrides.json"
MIN_LEN = 140

MANUAL_PATCH: dict[str, str] = {
    "kp-3-1-2": "- **移动应用系统**：是面向智能手机、平板等移动终端、强调弱网络、小屏幕与触控交互的信息系统。**作用**：用于移动场景下的跨平台交付、应用商店分发与离线/同步等设计决策。\n- **MVC（Model-View-Controller）**：是将数据模型、界面展示与用户交互控制分离的架构模式。**作用**：用于降低界面与业务耦合、便于移动端多视图复用同一模型。",
    "kp-3-4-2": "- **数据仓库**：是面向主题、集成、相对稳定、反映历史变化的数据集合，用于支持管理决策。**作用**：用于 OLAP 分析与从 OLTP 系统中抽取清洗后的历史数据。\n- **ETL**：是从源系统抽取、转换、加载到仓库的过程。**作用**：用于保证数据质量、一致性与可重复刷新。",
    "kp-4-1-2": "- **企业门户**：是集信息发布、应用集成、协作与单点登录于一体的企业 Web 入口。**作用**：用于统一员工访问渠道、整合后台应用与展示个性化工作台。",
    "kp-无代码-低代码": "- **低代码开发**：是通过可视化建模与少量脚本快速构建应用的方式，仍保留扩展代码能力。**作用**：用于缩短交付周期、降低对专业开发人员的依赖。\n- **无代码开发**：是由业务人员通过配置与拖拽完成应用组装、基本不需手写代码的方式。**作用**：用于简单流程与表单类需求的快速上线。",
    "kp-开源软件": "- **开源软件**：是源代码可获取、使用与修改权受开源许可证约束的软件。**作用**：用于降低成本、避免厂商锁定，但须评估许可合规、安全与社区可持续性。",
    "kp-网络规划-优化-配置-部署-实施": "- **网络规划**：是根据业务需求与约束制定网络建设目标、拓扑与演进路线。**作用**：用于立项与可行性阶段明确规模、可靠性与投资节奏。\n- **网络设计**：是在规划基础上确定地址、协议、安全域与设备选型。**作用**：用于指导配置模板与施工图纸。\n- **网络实施与验收**：是按设计完成布线、配置、调优与连通/性能测试。**作用**：用于交付可运行的生产网络并留下运维基线。",
    "kp-项目管理": "- **项目管理**：是在约束条件下通过启动、规划、执行、监控与收尾过程达成项目目标的管理活动。**作用**：用于组织范围、进度、成本、质量、风险与干系人协调（PMBOK 十大知识域）。\n- **WBS（工作分解结构）**：是将项目可交付成果逐层分解为可管理工作包的层次结构。**作用**：用于范围基准、进度估算与责任分配。",
    "kp-注意事项-解答步骤-摘要正文-评分": "- **论文摘要**：是用约 300～320 字概括项目背景、本人工作、效果与不足的结构化短文。**作用**：用于评卷快速把握全文主线，须与正文三问一致。\n- **论文正文三问**：是试题要求的三个独立论述问题。**作用**：用于分段作答、每问约 600～800 字并体现项目经历。",
    "kp-8-4": "- **问题分析（结构化方法）**：是在系统规划阶段对现行系统问题域进行识别、分解与建模的活动，常用 DFD 等工具。**作用**：用于明确系统边界与逻辑需求，为可行性论证与后续设计提供依据。\n- **DFD 四要素**：外部实体、加工、数据流、数据存储；**作用**：用于无歧义描述数据的来源、变换与去向。",
    "kp-10-4": "- **C/S 架构**：是客户端与服务器分工协作的应用架构。**作用**：用于局域网内功能较强客户端场景。\n- **B/S 架构**：是浏览器作为统一客户端、业务逻辑与数据集中在服务器端的架构。**作用**：用于跨平台访问与集中升级。\n- **三层架构**：是将表示层、业务逻辑层与数据访问层分离的结构。**作用**：用于降低耦合、支持伸缩与团队分工。",
    "kp-云计算": "- **云计算**：是按需、可计量、通过网络访问的可扩展 IT 资源与服务模式。**作用**：用于弹性扩容、降低基础设施投入。\n- **部署模式**：公有云、私有云、混合云；**作用**：用于在成本、合规与可控性之间权衡。",
    "kp-5-7": "- **UML（统一建模语言）**：是一套用标准图形符号描述软件系统静态结构与动态行为的可视化建模语言。**作用**：用于统一表达系统模型，支撑分析设计与沟通。\n- **用例图**：是刻画参与者与系统用例之间交互关系的 UML 行为图。**作用**：用于界定功能范围与交互目标。\n- **类图**：是描述类及静态关系的 UML 结构图。**作用**：用于展示概念/设计结构。\n- **序列图**：是按时间顺序描述对象间消息交互的 UML 行为图。**作用**：用于说明场景中对象如何协作。",
    "kp-5-6": "- **软件产品线**：是在共享核心资产（架构、组件、过程）基础上，通过变体绑定满足不同客户需求的软件组织方式。**作用**：用于组织级复用与规模化交付。",
    "kp-5-8": "- **形式化方法**：是基于数学规约与证明对软件进行描述与验证的方法。**作用**：用于安全攸关领域减少歧义与缺陷。",
}


def clean_def_block(text: str) -> str:
    lines: list[str] = []
    seen: set[str] = set()
    for ln in text.splitlines():
        s = ln.strip()
        if not s.startswith("- "):
            continue
        if "（答卷·必背）" in s and "**" not in s:
            continue
        plain = re.sub(r"\*\*", "", s)
        if plain in seen:
            continue
        key = re.sub(r"\*\*", "", s.split("：", 1)[0].split(":", 1)[0]).strip()
        if key in seen:
            continue
        seen.add(key)
        seen.add(plain)
        m = re.match(r"^-\s*(.+?)（答卷·定义）[：:]\s*(.+)$", s)
        if m:
            lines.append(
                r.polish_def_act_line(f"- **{m.group(1).strip()}**：{m.group(2).strip()}")
            )
            continue
        m2 = re.match(r"^-\s*(.+?)（答卷·作用）\*\*[：:]\s*(.+)$", s)
        if m2:
            lines.append(
                f"- **{m2.group(1).strip()}（作用）**：{m2.group(2).strip()}"
            )
            continue
        if "**" in s:
            lines.append(r.polish_def_act_line(s))
        else:
            lines.append(s)
        if len(lines) >= 14:
            break
    return "\n".join(lines)


def main() -> None:
    base = json.loads(OV_PATH.read_text(encoding="utf-8"))
    base.update(MANUAL_PATCH)
    items = boot.load_items()
    slices = r.assign_slices(items)
    out = dict(base)
    for it in items:
        pid = it["id"]
        if pid in r.SKIP_IDS or pid.startswith("kp-论文专题") or pid == "kp-内容":
            continue
        if pid in MANUAL_PATCH:
            out[pid] = clean_def_block(MANUAL_PATCH[pid])
            continue
        ch_text = ""
        ch_num = None
        if it.get("chapter"):
            ch_num = int(it["chapter"])
            cf = r.find_chapter_file(ch_num)
            if cf:
                ch_text = cf.read_text(encoding="utf-8")
        raw = boot.build_raw(it, items, slices)
        if not raw.strip():
            if pid in base and r.definition_text_len(base[pid]) >= MIN_LEN:
                out[pid] = clean_def_block(base[pid])
            continue
        title = it.get("title", "")
        keys = r.title_keywords(title)
        defs = r.finalize_definitions(pid, raw, title, keys, ch_text, ch_num)
        defs = clean_def_block(defs)
        if r.definition_text_len(defs) < MIN_LEN:
            if pid in base:
                out[pid] = clean_def_block(base[pid])
            continue
        if not r._def_has_what(defs) or not re.search(r"(作用|用于|主要用于)", defs):
            if pid in base:
                out[pid] = clean_def_block(base[pid])
            continue
        out[pid] = defs
    OV_PATH.write_text(
        json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print({"overrides": len(out)})


if __name__ == "__main__":
    main()
