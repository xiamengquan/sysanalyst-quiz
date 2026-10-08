#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""参照真题 75 题出题顺序与结构，将自编选择题组织为基础/进阶/困难三套模拟卷。

产出：public/data/mock-sets.json
- template: 75 个槽位的模块（与自编 ch 对齐）+ 各真题套对模板的吻合率
- sets: mock-basic / mock-medium / mock-advanced（每套 75 题，引用 practice 题 id）
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REAL = ROOT / "content/banks/real/综合知识/all.jsonl"
PRACTICE = ROOT / "content/banks/practice/all.jsonl"
OUT = ROOT / "public/data/mock-sets.json"

# 模块（与自编 practice ch 对齐）
MODULES = {
    0: "综合/法规/知识产权",
    1: "绪论/专业英语",
    2: "数学与工程基础",
    3: "计算机系统",
    4: "网络与分布式",
    5: "数据库",
    6: "企业信息化",
    7: "软件工程",
    8: "项目管理",
    9: "信息安全",
    10: "系统规划与分析",
    11: "需求工程",
    12: "软件架构",
    13: "系统设计",
    14: "实现与测试",
    15: "运行与维护",
}

# 真题题干+解析 → 模块关键词（按优先级）
KEYWORDS: list[tuple[str, int]] = [
    (r"知识产权|著作权|专利|商标|许可证|开源许可|MIT|GPL|专利权", 0),
    (r"标准化|国标|GB/T|行业标准", 0),
    (r"专业英语|English|for the|of the system|____ ?is|____ ?are", 1),
    (r"博弈论|线性规划|排队论|最短路径|最小生成树|图论|概率|期望|方差|正态分布|矩阵|贪心|动态规划|分治|递归式|决策树", 2),
    (r"奈奎斯特|香农|信道|带宽|曼彻斯特|编码|子网|子网掩码|IPv6|IPv4|路由|OSPF|BGP|TCP|UDP|DHCP|DNS|FTP|SMTP|POP3|ARP|ICMP|交换机|路由器|VLAN|防火墙|VPN|NAT|千兆|以太网|WLAN|5G|4G", 4),
    (r"Cache|高速缓存|存储器|RISC|CISC|流水线|中断|DMA|磁盘|RAID|总线|指令|寻址|内存|寄存器|多处理机|SMP|可靠性|MTBF|串并系统|校验码|海明码|CRC|原码|补码|浮点数", 3),
    (r"操作系统|进程|线程|死锁|页式|段式|虚拟存储|PV操作|信号量|作业调度|Spooling|文件系统|索引节点", 3),
    (r"数据库|关系代数|范式|NF|事务|并发控制|封锁|两段锁|视图|SQL|E-R|ER图|关系模式|候选键|主键|外键|分布式数据库|数据仓库|OLAP|NoSQL|反规范化|触发器|存储过程", 5),
    (r"ERP|CRM|SCM|企业信息化|电子商务|电子政务|BPR|业务流程重组|商业智能|BI|数据挖掘|信息资源|信息化战略|信息系统规划", 6),
    (r"软件工程|生命周期|瀑布|原型|螺旋|增量|迭代|RUP|统一过程|敏捷|Scrum|XP|CMM|CMMI|软件过程|能力成熟度|逆向工程|再工程|构件|软件复用|中间件|软件配置|基线|软件质量|McCabe|圈复杂度|软件测试|白盒|黑盒|回归测试|集成测试|确认测试|单元测试|驱动模块|桩模块", 7),
    (r"项目|WBS|挣值|CPI|SPI|关键路径|PERT|甘特图|风险管理|风险曝光|沟通渠道|质量保证|QA|配置管理|变更控制|范围蔓延|里程碑|赶工|进度网络", 8),
    (r"信息安全|加密|对称|非对称|RSA|AES|DES|数字签名|摘要|MD5|SHA|PKI|CA|证书|访问控制|RBAC|等保|容灾|备份|入侵检测|SQL注入|XSS|DDoS| Kerberos|蜜罐", 9),
    (r"可行性|系统规划|立项|数据流图|DFD|数据字典|系统分析|业务流程|TFD|BAM|BPM|IPO|结构化分析|需求获取|需求分析|需求规格|SRS|需求工程|需求跟踪|用例|参与者|场景|原型法|访谈|JRP|JAD|UML|用例图|类图|序列图|状态图|活动图", 11),
    (r"架构|架构风格|管道|过滤器|仓库|黑板|事件|客户机/服务器|分层|MVC|J2EE|Java EE|SOA|ESB|Web服务|SOAP|REST|微服务|云|大数据|AI|人工智能|机器学习|深度学习|区块链|物联网|嵌入式|实时操作系统|RTOS|CPS|数字孪生|边缘计算|容器|Docker|Kubernetes", 12),
    (r"系统设计|概要设计|详细设计|模块|内聚|耦合|结构图|界面设计|人机|数据库设计|概念结构|逻辑结构|物理结构|面向对象设计|设计模式|工厂|单例|观察者|策略|适配器|代理|SOLID", 13),
    (r"系统维护|适应性维护|完善性维护|预防性维护|改正性维护|软件文档|运行维护|遗留系统|系统转换|直接转换|并行转换|分段转换", 15),
    (r"系统测试|验收测试|Alpha|Beta|负载测试|压力测试|性能测试|测试用例设计|等价类|边界值|判定表|因果图|路径覆盖|语句覆盖", 14),
]

_diff_rank = {"basic": 0, "medium": 1, "deep": 2}


def classify(text: str) -> int:
    for pat, ch in KEYWORDS:
        if re.search(pat, text, re.I):
            return ch
    return 0  # 兜底：综合杂项


def main() -> None:
    reals = [json.loads(l) for l in REAL.read_text(encoding="utf-8").splitlines() if l.strip()]
    prac = [json.loads(l) for l in PRACTICE.read_text(encoding="utf-8").splitlines() if l.strip()]

    # ---------- 1) 真题 75 题顺序模板 ----------
    sets_seq: dict[str, list[int]] = {}
    for r in reals:
        key = f"{r['year']}{r.get('half', '上')}"
        if r.get("qnum") is None:
            continue
        seq = sets_seq.setdefault(key, [None] * 75)
        blob = f"{r.get('stem','')}\n{r.get('exp','')}"
        qn = int(r["qnum"])
        if 1 <= qn <= 75:
            seq[qn - 1] = classify(blob)

    template = []
    support = []
    for i in range(75):
        votes = [seq[i] for seq in sets_seq.values() if i < len(seq) and seq[i] is not None]
        if not votes:
            continue
        top, cnt = Counter(votes).most_common(1)[0]
        template.append({"qnum": i + 1, "ch": top, "module": MODULES[top]})
        support.append(cnt / len(votes))

    mean_support = round(sum(support) / len(support), 3)
    print({"template_len": len(template), "mean_support": mean_support,
           "low_support_slots": [t["qnum"] for t, s in zip(template, support) if s < 0.45]})

    # ---------- 2) 自编池：按模块 & 难度 ----------
    pool: dict[int, list[dict]] = defaultdict(list)
    for p in prac:
        pool[int(p.get("ch", 0))].append(p)

    used_global: set[str] = set()
    diff_order = {
        "mock-basic": (["basic", "medium", "deep"], "diff_first"),
        "mock-medium": (["medium", "deep", "basic"], "module_first"),
        "mock-advanced": (["deep", "medium", "basic"], "diff_first"),
    }
    mode_of = {k: v[1] for k, v in diff_order.items()}
    diff_order = {k: v[0] for k, v in diff_order.items()}
    titles = {
        "mock-basic": "模拟卷 · 基础（75 题 · 对齐真题顺序）",
        "mock-medium": "模拟卷 · 进阶（75 题 · 对齐真题顺序）",
        "mock-advanced": "模拟卷 · 困难（75 题 · 对齐真题顺序）",
    }

    def pick(slot_ch: int, prefer: list[str], taken: set[str], mode: str) -> dict | None:
        def from_pool(chs: list[int], wants: list[str]) -> dict | None:
            for ch_try in chs:
                for want in wants:
                    candidates = [x for x in pool.get(ch_try, [])
                                  if x["id"] not in taken and x["id"] not in used_global
                                  and x.get("difficulty") == want]
                    if candidates:
                        # 优先情景题（贴近真题风格）
                        candidates.sort(key=lambda x: 0 if x.get("style_track") == "scenario" else 1)
                        return candidates[0]
            return None

        adj = []
        for d in (1, 2):
            if slot_ch - d >= 0:
                adj.append(slot_ch - d)
            if slot_ch + d <= 15:
                adj.append(slot_ch + d)
        all_chs = [c for c in range(16) if c != slot_ch]

        def want_major(chs: list[int], wants: list[str]) -> dict | None:
            # 难度为主：先按 want 遍历所有 chs，再降级下一个 want
            for want in wants:
                for ch_try in chs:
                    candidates = [x for x in pool.get(ch_try, [])
                                  if x["id"] not in taken and x["id"] not in used_global
                                  and x.get("difficulty") == want]
                    if candidates:
                        candidates.sort(key=lambda x: 0 if x.get("style_track") == "scenario" else 1)
                        return candidates[0]
            return None

        if mode == "module_first":
            # 模块优先（进阶卷：medium 池仅 72 题且集中于 ch11，需保覆盖面）
            # 但在同组模块内按难度优先（want-major），避免低难度抢跑
            return (want_major([slot_ch] + adj, prefer)
                    or want_major(all_chs, prefer)
                    or from_pool([slot_ch], prefer[1:])
                    or from_pool(all_chs, prefer[1:]))

        # 难度优先（基础/困难卷）：1) 本模块首选难度
        got = from_pool([slot_ch], [prefer[0]])
        if got is not None:
            return got
        # 2) 相邻模块首选难度
        got = from_pool(adj, [prefer[0]])
        if got is not None:
            return got
        # 3) 全池首选难度（保难度身份）
        got = from_pool(all_chs, [prefer[0]])
        if got is not None:
            return got
        # 4) 难度降级：本模块 → 相邻 → 全池
        return from_pool([slot_ch], prefer[1:]) or from_pool(adj, prefer[1:]) or from_pool(all_chs, prefer[1:])

    sets_out = []
    reuse_report = {}
    for set_id in ("mock-basic", "mock-medium", "mock-advanced"):
        taken: set[str] = set()
        items = []
        fallback_chs = Counter()
        for slot in template:
            got = pick(slot["ch"], diff_order[set_id], taken, mode_of[set_id])
            if got is None:
                # 全模块兜底：任意未用题，按难度优先
                for want in diff_order[set_id]:
                    cand = [x for x in prac if x["id"] not in taken and x["id"] not in used_global
                            and x.get("difficulty") == want]
                    if cand:
                        got = cand[0]
                        break
            if got is None:  # 极端情况：允许复用其他套已用题
                cand = [x for x in prac if x["id"] not in taken]
                got = cand[0] if cand else None
                if got:
                    reuse_report.setdefault(set_id, []).append(got["id"])
            if got is None:
                continue
            taken.add(got["id"])
            used_global.add(got["id"])
            items.append({
                "qnum": slot["qnum"],
                "id": got["id"],
                "ch": int(got.get("ch", slot["ch"])),
                "module": MODULES.get(int(got.get("ch", slot["ch"])), MODULES[slot["ch"]]),
                "diff": got.get("difficulty", "basic"),
                "style": got.get("style_track", "short"),
            })
            if got.get("ch") != slot["ch"]:
                fallback_chs[slot["qnum"]] = int(got.get("ch"))
        diff_cnt = Counter(i["diff"] for i in items)
        sets_out.append({
            "id": set_id,
            "title": titles[set_id],
            "total": len(items),
            "diffSummary": dict(diff_cnt),
            "items": items,
        })
        print({set_id: len(items), "diff": dict(diff_cnt),
               "reused_from_other_sets": len(reuse_report.get(set_id, []))})

    out = {
        "meta": {
            "builtAt": date.today().isoformat(),
            "source": "practice(730) · 结构参照真题15套(2014上—2026上)众数顺序",
            "templateSupport": mean_support,
        },
        "template": template,
        "sets": sets_out,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")

    # 自检
    qids = {x["id"] for x in prac}
    problems = []
    for s in sets_out:
        if s["total"] != 75:
            problems.append(f"{s['id']} total={s['total']}")
        ids = [i["id"] for i in s["items"]]
        if len(set(ids)) != len(ids):
            problems.append(f"{s['id']} 内部重复")
        for i in s["items"]:
            if i["id"] not in qids:
                problems.append(f"{s['id']} 引用不存在: {i['id']}")
    all_ids = [i["id"] for s in sets_out for i in s["items"]]
    cross = len(all_ids) - len(set(all_ids))
    print({"selfCheck": problems or "ok", "crossSetReuse": cross})
    raise SystemExit(1 if problems else 0)


if __name__ == "__main__":
    main()