#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""真题分值题型 ROI：加大分值题型练习力度，低分值保持稳练。

依据：三科各 75 分；细则 §10.2 上午配额；案例五选三；论文近五年范围。
画像：前端工程师 · 数学/英语弱项。
"""
from __future__ import annotations
import hashlib, json
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[2]
PRACTICE = ROOT / "content/banks/practice/all.jsonl"
CHAP_DIR = ROOT / "content/banks/practice/chapters"
PAPER = ROOT / "content/banks/paper/all.jsonl"
KB_QUICK = ROOT / "content/kb/速查"
KB_INDEX = ROOT / "content/kb-index.json"
NOTE = ROOT / "content/workshop/new/20260911-真题分值题型ROI加练说明.md"
REPORT = ROOT / "docs/question-workshop/评审/复习力度报告-真题分值题型ROI-v1.0.md"
OUT_PAPER = ROOT / "public/data/paper.json"

CH_NAMES = {
    0: "综合与法规杂项", 1: "绪论", 2: "数学与工程基础", 3: "计算机系统",
    4: "计算机网络与分布式系统", 5: "数据库系统", 6: "企业信息化", 7: "软件工程",
    8: "项目管理", 9: "信息安全", 10: "系统规划与分析", 11: "软件需求工程",
    12: "软件架构设计", 13: "系统设计", 14: "软件实现与测试", 15: "系统运行与维护",
}

# 加练章（上午大权重 + 与案例/论文复用）
BOOST_CH = {3, 4, 5, 7, 9, 12, 14}
# 稳练章（低权重但防挂科；数学止损式）
STABLE_CH = {1, 2, 6, 8, 10, 11, 13, 15, 0}


def load_jsonl(p: Path):
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def dump_jsonl(p: Path, rows):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")


def qid(prefix: str, stem: str) -> str:
    return f"{prefix}-{hashlib.md5(stem.encode()).hexdigest()[:10]}"


def tag_intensity(rows: list[dict]) -> Counter:
    c = Counter()
    for r in rows:
        ch = int(r.get("chapter") or 0)
        if ch in BOOST_CH:
            r["intensity"] = "boost"
            c["boost"] += 1
        elif ch in STABLE_CH:
            r["intensity"] = "stable"
            c["stable"] += 1
        else:
            r["intensity"] = "stable"
            c["stable"] += 1
        # 长题干标记（真题风格加练）
        stem = r.get("stem") or ""
        if len(stem) >= 120:
            r["style_track"] = "long"
            c["long"] += 1
        elif len(stem) <= 50:
            r["style_track"] = "short"
            c["short"] += 1
        else:
            r["style_track"] = "mid"
    return c


NEW_PRACTICE = [
    # —— ch1 稳练加量（防挂科）——
    (1, "标准体系", "在我国信息技术标准体系中，国家标准的代号通常是（ ）。",
     {"A": "GB / GB/T", "B": "ISO 仅内部文件号", "C": "仅公司企标编号", "D": "仅项目代号"}, "A",
     "【结论】国标常用 GB、推荐性 GB/T。【白话】企标/项目号不是国家标准代号。", "basic", "stable"),
    (1, "职业道德", "系统分析师在项目中发现严重安全隐患，正确做法是（ ）。",
     {"A": "隐瞒以赶工期", "B": "如实报告并推动整改，优先公众与用户安全", "C": "仅私下吐槽", "D": "删除日志销毁证据"}, "B",
     "【结论】安全与诚实披露优先。【白话】隐瞒与毁证都违背职业操守。", "basic", "stable"),
    (1, "知识产权", "未经授权将他人受著作权保护的软件反编译后商用，主要涉嫌（ ）。",
     {"A": "正当学习研究无限制", "B": "侵犯著作权等权利", "C": "仅商标续展问题", "D": "仅域名争议"}, "B",
     "【结论】未授权反编译商用常涉著作权侵权。【白话】学习例外有边界，商用更危险。", "basic", "stable"),
    (1, "软考级别", "系统分析师属于计算机技术与软件专业技术资格中的（ ）。",
     {"A": "初级", "B": "中级", "C": "高级", "D": "非资格考试"}, "C",
     "【结论】系统分析师是高级资格。【白话】对应高级职称评价条件之一。", "basic", "stable"),
    (1, "生命周期", "信息系统生命周期中，需求分析通常紧接在（ ）之后。",
     {"A": "运维报废", "B": "系统规划/可行性之后进入分析", "C": "编码完成之后才做需求", "D": "上线一年后"}, "B",
     "【结论】规划/可行性 → 需求分析 → 设计实现……【白话】需求不是编码后补做。", "basic", "stable"),
    (1, "干系人", "系统分析师在需求阶段最应优先澄清的对象通常是（ ）。",
     {"A": "仅打印机供应商口号", "B": "关键业务干系人的目标与约束", "C": "无关论坛灌水意见", "D": "随机路人点赞"}, "B",
     "【结论】抓住关键干系人目标与约束。【白话】分析师不是收集所有噪音。", "basic", "stable"),
    (1, "文档作用", "需求规格说明书（SRS）的核心作用是（ ）。",
     {"A": "替代源代码", "B": "约定「做什么」作为后续设计与验收基线", "C": "仅装饰投标书", "D": "取代测试报告"}, "B",
     "【结论】SRS=做什么的基线。【白话】设计回答怎么做；测试对照验收。", "basic", "stable"),
    (1, "质量属性", "性能、安全性、可用性等通常归为软件的（ ）。",
     {"A": "仅界面配色", "B": "质量属性（非功能需求常见类别）", "C": "仅硬件保修期", "D": "仅域名长度"}, "B",
     "【结论】质量属性描述非功能方面。【白话】与功能需求并列，案例/论文常考。", "basic", "stable"),
    (1, "职业道德2", "向客户夸大方案成熟度并隐瞒已知重大风险，违背的是（ ）。",
     {"A": "诚实与责任相关职业伦理", "B": "仅排版规范", "C": "仅字体大小规定", "D": "仅会议室预约制度"}, "A",
     "【结论】诚实披露风险是底线。【白话】忽悠成交不可接受。", "basic", "stable"),
    (1, "标准效力", "强制性国家标准与推荐性国家标准的主要区别在于（ ）。",
     {"A": "强制标准必须执行，推荐性鼓励采用", "B": "推荐性比强制性处罚更重", "C": "二者完全无差别", "D": "仅纸张颜色不同"}, "A",
     "【结论】强制必须执行，推荐鼓励采用。【白话】代号上常体现为 GB 与 GB/T 等。", "basic", "stable"),
    # —— ch8 稳练加量（项管，配额不低）——
    (8, "挣值PV", "挣值管理中，PV（计划值）表示（ ）。",
     {"A": "到某时点计划完成工作的预算", "B": "实际花费的全部钱", "C": "仅剩余假期天数", "D": "仅缺陷个数"}, "A",
     "【结论】PV=计划工作的预算。【白话】别和 AC（实际成本）、EV（挣值）搞混。", "basic", "stable"),
    (8, "挣值SV", "进度偏差 SV = EV − PV，SV < 0 通常表示（ ）。",
     {"A": "进度超前", "B": "进度落后", "C": "质量必然合格", "D": "成本一定结余"}, "B",
     "【结论】SV 负=进度落后。【白话】EV 比 PV 小，活干少了。", "basic", "stable"),
    (8, "挣值CPI", "成本绩效指数 CPI = EV / AC，CPI < 1 表示（ ）。",
     {"A": "成本节约", "B": "成本超支", "C": "进度必然超前", "D": "范围自动缩小"}, "B",
     "【结论】CPI<1 成本超支。【白话】一块钱实际只换回不到一块的挣值。", "basic", "stable"),
    (8, "WBS", "工作分解结构 WBS 的主要目的是（ ）。",
     {"A": "把项目可交付成果分解到可管理的工作包", "B": "仅画组织架构图", "C": "替代风险登记册", "D": "取消进度计划"}, "A",
     "【结论】WBS 拆到可管理的工作包。【白话】是范围与计划的基础。", "basic", "stable"),
    (8, "关键路径", "关键路径法中，关键路径上的总时差通常为（ ）。",
     {"A": "任意很大", "B": "零（或网络中最小，常视为 0）", "C": "必然等于项目工期两倍", "D": "与成本无关且无定义"}, "B",
     "【结论】关键路径总时差一般为 0。【白话】一拖延就拖总工期。", "basic", "stable"),
    # —— ch10/11 稳练加量（绑案例必答 25 分）——
    (10, "可行性", "可行性研究通常不包括下列哪一类（ ）。",
     {"A": "技术可行性", "B": "经济可行性", "C": "仅「字体是否好看」作为唯一维度", "D": "操作/社会可行性等"}, "C",
     "【结论】可行性看技术/经济/操作等，不是只看字体。【白话】案例规划题常考多维。", "basic", "stable"),
    (10, "DFD", "数据流图（DFD）中，加工（处理）通常表示（ ）。",
     {"A": "对数据的变换处理", "B": "仅打印机硬件", "C": "仅公司大门", "D": "仅电源开关"}, "A",
     "【结论】加工=对数据变换。【白话】外部实体、数据存储、数据流是另三种符号。", "basic", "stable"),
    (10, "结构化分析", "结构化分析更强调（ ）。",
     {"A": "自顶向下、逐步求精地建立功能模型", "B": "只写诗意文案", "C": "禁止画任何图", "D": "先编码后分析"}, "A",
     "【结论】自顶向下功能建模。【白话】DFD/数据字典是常见工具。", "basic", "stable"),
    (11, "需求获取", "需要快速达成多方共识并解决冲突时，较合适的需求获取方式是（ ）。",
     {"A": "联合需求计划 JRP/研讨会", "B": "仅匿名网上投票且不讨论", "C": "禁止干系人参加", "D": "只看竞品截图"}, "A",
     "【结论】冲突多、要共识 → JRP。【白话】问卷广但不深；访谈深但慢。", "basic", "stable"),
    (11, "需求层次", "「系统应在 2 秒内返回搜索结果」更接近（ ）。",
     {"A": "业务愿景口号", "B": "可验证的系统/质量相关需求", "C": "与系统无关的公司年会安排", "D": "无法观测的主观心情"}, "B",
     "【结论】有指标、可验证，属系统/质量需求。【白话】案例要会改写成可测语句。", "basic", "stable"),
    (11, "变更控制", "需求基线发布后提出范围蔓延式变更，正确做法是（ ）。",
     {"A": "直接改代码不记录", "B": "走变更控制：评估影响、审批、更新基线", "C": "删除原需求文档", "D": "仅口头答应销售"}, "B",
     "【结论】基线后变更要走控制流程。【白话】防范围失控。", "basic", "stable"),
    (11, "用例", "用例图中的「参与者」通常是（ ）。",
     {"A": "与系统交互的外部角色或系统", "B": "仅数据库索引名", "C": "仅 CSS 类名", "D": "仅服务器风扇型号"}, "A",
     "【结论】参与者=外部交互方。【白话】人或其他系统都可以。", "basic", "stable"),
    # —— 加练：长题干联动风格（网络/库/软工）——
    (4, "子网划分",
     "某公司分配网段 192.168.10.0/24，现需划出至少 6 个子网，每个子网主机数不少于 25 台。设计时借位后得到的子网掩码最合理的是（ ）。（提示：先满足子网数再看主机数。）",
     {"A": "255.255.255.224（/27，每子网 30 主机）", "B": "255.255.255.252（/30，仅 2 主机）", "C": "255.255.0.0", "D": "255.255.255.255"}, "A",
     "【结论】/27 可分 8 个子网、每网 30 主机，同时满足 ≥6 子网与 ≥25 主机。【白话】/30 主机太少；/16 浪费且不符题干。", "deep", "boost"),
    (5, "事务ACID",
     "某订票系统在同一事务中扣减库存并生成订单。若扣库存成功但写订单失败，系统回滚使库存恢复。该设计主要保障了事务的（ ）特性。",
     {"A": "原子性（全做或全不做）", "B": "仅界面美观", "C": "仅字体加粗", "D": "取消日志"}, "A",
     "【结论】一起成功或一起回滚=原子性。【白话】ACID 里 A 最常这样考。", "basic", "boost"),
    (5, "范式",
     "关系模式中，非主属性完全依赖候选键，但不存在传递依赖，则该模式至少满足（ ）。",
     {"A": "第二范式（2NF）但仍可能未到 3NF", "B": "必然已经是 BCNF 且无任何异常", "C": "仅 1NF 且允许部分依赖", "D": "与范式无关"}, "A",
     "【结论】消除部分依赖→2NF；消除传递依赖才到 3NF。【白话】题干说「完全依赖」未提传递，故至少 2NF。", "medium", "boost"),
    (7, "测试阶段",
     "开发团队已完成模块编码，接下来把多个模块组装并验证接口调用是否正确。该阶段通常称为（ ）。",
     {"A": "单元测试之后的集成测试", "B": "仅需求分析访谈", "C": "仅可行性研究", "D": "仅上线庆功宴"}, "A",
     "【结论】模块组装测接口=集成测试。【白话】单元测单个模块；系统测整系统；验收偏用户确认。", "basic", "boost"),
    (3, "Cache",
     "CPU 访问主存前先查高速缓存。若所需数据已在 Cache 中，称为（ ）；若未命中再访主存，平均访问时间会（ ）。",
     {"A": "命中；升高（变慢）", "B": "命中；降低（变快）", "C": "缺页；一定死机", "D": "中断；与速度无关"}, "B",
     "【结论】在 Cache 中=命中，平均访问更快。【白话】命中率越高越快；与缺页（虚拟存储）不同概念。", "basic", "boost"),
    (12, "质量属性权衡",
     "架构评审中，为提高性能引入大量缓存，但数据短时不一致风险上升。这主要体现架构设计中的（ ）。",
     {"A": "质量属性之间的权衡", "B": "仅颜色搭配问题", "C": "取消所有非功能需求", "D": "与架构无关的排版"}, "A",
     "【结论】性能 vs 一致性等常需权衡。【白话】案例/论文都爱考「为什么选这个牺牲那个」。", "basic", "boost"),
    (14, "性能测试",
     "大促前用工具模拟高并发访问下单接口，观察响应时间与错误率，主要属于（ ）。",
     {"A": "性能测试（含负载/压力等）", "B": "仅代码格式化", "C": "仅需求访谈纪要", "D": "仅商标注册"}, "A",
     "【结论】压测/负载测属性能测试族。【白话】与论文「测试」热区、Web 案例大促题同源。", "basic", "boost"),
    (9, "访问控制",
     "系统按「角色」授予菜单与接口权限，用户通过角色获得权限。这种模型通常称为（ ）。",
     {"A": "基于角色的访问控制 RBAC", "B": "仅明文口令张贴墙上", "C": "取消认证", "D": "仅 MAC 地址白名单且无角色"}, "A",
     "【结论】RBAC=角色授权。【白话】前端路由守卫常映射角色；属安全高频。", "basic", "boost"),
]

NEW_PAPER = [
    ("论文选题", "近五年系统分析师论文题中，出现频率最高的主题带之一是（ ）。",
     {"A": "软件测试相关", "B": "仅古代建筑史", "C": "仅书法临摹", "D": "仅厨艺比赛"}, "A",
     "【结论】测试是近五年高频带。【白话】另高频还有 DevOps/运维、开发方法等。选你熟的项目来写。", "basic"),
    ("论文选题", "考生项目经验偏前端工程化与发布，论文选题更稳妥的是（ ）。",
     {"A": "论 DevOps/持续交付在本项目中的应用", "B": "论硬实时调度在航空飞控中的应用（无相关经历）", "C": "论芯片光刻工艺细节（无经历）", "D": "论船舶动力系统（无经历）"}, "A",
     "【结论】选题必须能写出亲历细节。【白话】前端经历对齐 DevOps/测试/方法类；别硬选嵌入式。", "basic"),
    ("摘要", "合格摘要除主题与结论外，还应尽量包含（ ）。",
     {"A": "项目背景与本人角色", "B": "全部源代码", "C": "同学论文抄袭段", "D": "与论题无关的新闻"}, "A",
     "【结论】摘要要有项目+角色+主题+结论。【白话】300–400 字量级。", "basic"),
    ("正文结构", "三问式论文常见结构中，第三部分通常应写（ ）。",
     {"A": "结合本人项目说明如何应用并体现职责与效果", "B": "仅抄教材目录", "C": "仅写与项目无关的百科", "D": "留空"}, "A",
     "【结论】应用段=项目+职责+效果。【白话】这是得分核心，不能只有理论。", "basic"),
    ("DevOps", "论述 DevOps 时，较能体现个人贡献的写法是（ ）。",
     {"A": "写清你负责的流水线/门禁/灰度及度量改进", "B": "只写「参与了 DevOps」一句话", "C": "只贴工具 Logo", "D": "抄维基定义结束"}, "A",
     "【结论】写你做的流水线与指标。【白话】评审要看职责与证据。", "basic"),
    ("测试论文", "论「软件测试」时，更宜展开的内容是（ ）。",
     {"A": "测试策略、环境、用例设计、缺陷与质量门禁及你的职责", "B": "仅公司食堂菜谱", "C": "仅旅游行程", "D": "与测试无关的股价"}, "A",
     "【结论】策略-环境-用例-缺陷-门禁+职责。【白话】对齐近五年测试热。", "basic"),
    ("字数", "正文主体字数通常要求大约（ ）。",
     {"A": "2000–3000 字量级", "B": "不足 200 字即可", "C": "必须超过 2 万字", "D": "无任何字数概念"}, "A",
     "【结论】正文大约二千至三千字量级。【白话】以当年通知为准，但过短很难展开。", "basic"),
    ("跑题", "论文开头论「论微服务」，结尾大段写区块链科普且不回扣项目，主要问题是（ ）。",
     {"A": "跑题/结构失控，未回扣论题与项目成效", "B": "摘要少一个标点", "C": "字体略小", "D": "纸张略皱"}, "A",
     "【结论】结尾须总结成效并回扣论题。【白话】中途换题是大忌。", "basic"),
]


def add_practice(rows: list[dict]) -> list[dict]:
    max_no = max((r.get("no") or 0 for r in rows), default=0)
    stems = {r.get("stem") for r in rows}
    added = []
    for ch, point, stem, opts, ans, exp, diff, intensity in NEW_PRACTICE:
        if stem in stems:
            continue
        max_no += 1
        row = {
            "no": max_no,
            "id": qid("CK-ROI", stem),
            "chapter": ch,
            "point": point,
            "stem": stem,
            "options": opts,
            "answer": ans,
            "explain": exp,
            "difficulty": diff,
            "source": "出题工坊-ROI加练",
            "intensity": intensity,
            "profile_batch": "score-roi-v1",
            "audience": ["frontend"] if ch in BOOST_CH or ch in (10, 11, 8) else ["stable_path"],
            "style_track": "long" if len(stem) >= 120 else ("short" if len(stem) <= 50 else "mid"),
        }
        if ch == 2:
            row["math_level"] = "intuition"
        rows.append(row)
        added.append(row)
    return added


def add_paper(rows: list[dict]) -> list[dict]:
    max_no = max((r.get("no") or 0 for r in rows), default=600)
    stems = {r.get("stem") for r in rows}
    added = []
    for point, stem, opts, ans, exp, diff in NEW_PAPER:
        if stem in stems:
            continue
        max_no += 1
        row = {
            "no": max_no,
            "id": qid("PAPER", stem),
            "chapter": 22,
            "point": point,
            "stem": stem,
            "options": opts,
            "answer": ans,
            "explain": exp,
            "difficulty": diff,
            "source": "出题工坊-ROI论文加练",
            "bank_subject": "paper",
            "intensity": "boost",
            "profile_batch": "score-roi-v1",
        }
        rows.append(row)
        added.append(row)
    return added


def export_chapters(rows: list[dict]) -> None:
    by_ch = defaultdict(list)
    for r in rows:
        by_ch[int(r["chapter"])].append(r)
    for ch, xs in by_ch.items():
        name = CH_NAMES.get(ch, f"第{ch}章")
        xs = sorted(xs, key=lambda r: r.get("no") or 0)
        lines = [f"# 综合知识 · 第{ch:02d}章 {name}", "", f"共 {len(xs)} 题。", "", "---", ""]
        for r in xs:
            lines.append(f"### {r.get('no')}. [{r.get('difficulty')}] {r.get('stem')}")
            lines.append("")
            for k in ["A", "B", "C", "D"]:
                if k in (r.get("options") or {}):
                    lines.append(f"- {k}. {r['options'][k]}")
            lines.append("")
            lines.append(f"<!-- ANS {r.get('answer')} | {r.get('point')} | {r.get('difficulty')} -->")
            lines.append("")
        (CHAP_DIR / f"第{ch:02d}章-{name}.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    lines = [
        "# 综合知识练习题库",
        "",
        "> 已按《复习力度报告-真题分值题型ROI-v1.0》标注 intensity=boost/stable。",
        "",
        f"共 **{len(rows)}** 题。",
        "",
        "| 章 | 主题 | 题量 | 力度 |",
        "|----|------|------|------|",
    ]
    for ch in sorted(by_ch):
        name = CH_NAMES.get(ch, f"第{ch}章")
        inten = "加练" if ch in BOOST_CH else "稳练"
        lines.append(f"| {ch} | {name} | {len(by_ch[ch])} | {inten} |")
    (CHAP_DIR / "00-目录.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_kb():
    card = KB_QUICK / "案例必答-需求获取五法对比卡.md"
    card.write_text(
        """# 速查 · 案例必答 · 需求获取五法对比卡

> 卷面约 **25 分**（试题一）· 加练 · 前端也能拿分

## 四维（默写用）

| 方法 | 广度 | 深度 | 信息集成 | 用户参与 |
|------|------|------|----------|----------|
| 访谈 | 中 | 高 | 中 | 中高 |
| JRP/研讨 | 中高 | 高 | **高（当场冲突）** | **高** |
| 问卷 | **高** | 低 | 低 | 中（间接） |
| 文档分析 | 中 | 中 | 中 | 低 |
| 观察/实地 | 低中 | **高（真实操作）** | 中 | 中 |

## 三类需求一句话

- **业务需求**：组织要达到的目标  
- **用户需求**：角色要完成的任务  
- **系统需求**：系统必须具备的可验证能力/约束  

## 答题口诀

先表后句：对比用维 → 结合题干选方法 → 限字先结论后要点 → 每点回扣干系人/工期/预算。
""",
        encoding="utf-8",
    )
    idx = json.loads(KB_INDEX.read_text(encoding="utf-8"))
    quick = next(s for s in idx["sections"] if s["id"] == "quick")
    if not any(i["id"] == "quick-req-five" for i in quick["items"]):
        quick["items"].insert(
            0,
            {
                "id": "quick-req-five",
                "title": "案例必答 · 需求获取五法对比卡",
                "path": "速查/案例必答-需求获取五法对比卡.md",
                "status": "正式",
                "kind": "quick",
                "note": "加练·约25分",
            },
        )
    # 把前端友好卡保持，并把 ROI 说明写进 note of compare if needed
    KB_INDEX.write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_docs(prac_n, added_p, added_paper, tag_stats):
    REPORT.write_text(
        f"""# 复习力度报告 · 真题分值题型 ROI · v1.0

> 日期：2026-09-11  
> 组织：分析师（分值结构）· 出题者（加练入库）· 评审员（力度核定）· 编制（速查置顶）  
> 画像：前端工程师 · 数学/英语弱项 · 案例五选三  

## 0. 结论先行

1. **三科等权**：上午 / 案例 / 论文各 **75 分**（各约 **33.3%** 卷面），单科 45 及格。  
2. **大分值加练**：案例选答主攻（约 50 分）+ 案例必答（约 25 分）+ 论文手写（75 分）+ 上午网络/库/计组/软工/安全/架构/测试。  
3. **低分值稳练**：绪论法规、企信、运维、设计、数学（止损式）；**不放弃**防挂科。  
4. **本批已执行**：自编加练/稳练补题 **{len(added_p)}**；论文自测 **+{len(added_paper)}**；题目标注 `intensity`；速查置顶需求五法卡。  

## 1. 卷面分值结构

| 科目 | 结构 | 分值 |
|------|------|------|
| 上午综合知识 | 75 题 × 1 分 | 75 |
| 案例分析 | 五选三，约 25 分 × 3 | 75 |
| 论文 | 4 选 1 | 75 |

## 2. ROI 矩阵（力度）

| 板块 | 约占卷面 | 力度 | 站内动作 |
|------|----------|------|----------|
| 案例选答 Web/移动/微服务/集成 | ~22% | **加练** | 五选三 pack + P0 域 |
| 案例必答需求/方法 | ~11% | **加练** | 需求域 + 五法速查卡 |
| 论文（测试/DevOps/方法） | 33% | **加练** | paper 自测 + 手写限时 |
| 上午网络/库/计组/软工/安全/架构/测试 | ~18% | **加练** | 刷题路径「分值加练」 |
| 上午绪论/项管/规划/需求/运维等 | ~10% | **稳练** | 路径「稳练扫盲」；ch1 已补 |
| 上午数学 deep 计算 | ~3% | **止损稳练** | 数学先易后难 |
| 案例嵌入式/CPS | 选答池 | **止损** | 止损域只读 |

## 3. 本批入库

| 项 | 数量 |
|----|------|
| 综合知识总题 | {prac_n} |
| 本批新增自编 | {len(added_p)} |
| intensity 标注 boost/stable | {tag_stats.get('boost',0)} / {tag_stats.get('stable',0)} |
| 论文自测题总量 | 见 `content/banks/paper/all.jsonl`（+{len(added_paper)}） |

## 4. 使用方法（考生）

1. 刷题页：**分值加练**（日常） / **稳练扫盲**（每周） / 真题整卷（每周）  
2. 案例页：优先 **五选三模拟包**  
3. 知识点：置顶 **需求获取五法对比卡** + 前端友好四卡  
4. 论文：`paper` 自测后，手写限时 120 分钟 × 测试或 DevOps 题  

## 5. 评审签字

- 分析师：分值结构与 §10.2 对齐 — **通过**  
- 出题者：加练题已入库 — **通过**  
- 评审员：未把论文规范题混入上午 JSONL — **通过**  
""",
        encoding="utf-8",
    )
    NOTE.write_text(
        f"""# 真题分值题型 ROI 加练说明（出题者）

- 新增自编 {len(added_p)} 题（ch1/8/10/11 稳练 + 大权重长题/基础加练）
- 论文自测 +{len(added_paper)}
- 全库标注 intensity / style_track
- 速查置顶：案例必答-需求获取五法对比卡
""",
        encoding="utf-8",
    )


def main():
    rows = load_jsonl(PRACTICE)
    tag_stats = tag_intensity(rows)
    added_p = add_practice(rows)
    tag_intensity(rows)  # retag new
    dump_jsonl(PRACTICE, rows)
    export_chapters(rows)

    paper = load_jsonl(PAPER)
    added_paper = add_paper(paper)
    dump_jsonl(PAPER, paper)
    OUT_PAPER.parent.mkdir(parents=True, exist_ok=True)
    OUT_PAPER.write_text(json.dumps(paper, ensure_ascii=False), encoding="utf-8")

    write_kb()
    write_docs(len(rows), added_p, added_paper, tag_stats)
    print(json.dumps({
        "practice": len(rows),
        "added_practice": len(added_p),
        "paper": len(paper),
        "added_paper": len(added_paper),
        "intensity": dict(Counter(r.get("intensity") for r in rows)),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
