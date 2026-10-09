#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""知识点残缺表修复：按《结构式模板 v2》对 28 处残缺表格做精确回填/重构。

数据来源：归档通章（第03/06/16/20章）与同章完整表；通用规则补空行/删空节。
"""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POINTS = ROOT / "content/kb/points"

SEP3 = "|------|------|------|"
SEP4 = "|------|------|------|------|"

# ---------- 授权内容（源：归档通章/同章完整表/教程标准考点） ----------
T_DAS = [
    "| 对比项 | DAS | NAS | SAN |",
    "|--------|-----|-----|-----|",
    "| 连接 | 直连主机 | 以太网文件级 | FC/iSCSI 块级 |",
    "| 共享 | 差 | 好（NFS/CIFS） | 好（块级多主机） |",
    "| 扩展 | 差 | 中 | 强 |",
    "| 场景 | 单机存储 | 小文件共享 | 数据库/核心存储 |",
]
T_DRAM = [
    "| 对比项 | DRAM | SRAM | ROM |",
    "|--------|------|------|-----|",
    "| 刷新 | 需要 | 不需要 | 不需要 |",
    "| 速度 | 较慢 | 快 | — |",
    "| 断电 | 数据丢失 | 数据丢失 | 数据保留 |",
    "| 用途 | 主存 | Cache | BIOS/固件 |",
]
T_CISC = [
    "| 对比项 | CISC | RISC |",
    "|--------|------|------|",
    "| 指令数 | 多（100~250） | 少 |",
    "| 指令长度 | 变长 | 固定 |",
    "| 寻址方式 | 5~20种 | 少 |",
    "| 控制器 | 微程序 | 硬布线 |",
    "| CPI | 4~10 | ≈1 |",
    "| 访存 | 直接访存 | Load/Store |",
]
T_IO = [
    "| 对比项 | 程序查询 | 中断 | DMA |",
    "|--------|----------|------|------|",
    "| CPU 介入 | 全程轮询等待 | 响应时介入处理 | 仅传送时让出总线 |",
    "| CPU 效率 | 最低 | 较高（部分并行） | 高（批量传送） |",
    "| 数据路径 | 外设→CPU→主存 | 外设→CPU→主存 | 外设↔主存直接 |",
    "| 适用场景 | 低速设备 | 中低速、偶发事件 | 高速块设备 |",
]
T_STACK = [
    "| Java EE | Spring + Struts + Hibernate（SSH） | MVC + IoC + ORM |",
    "| Java EE | JSF | 标准 Web 框架，FacesServlet |",
    "| .NET | CLR + ADO.NET + ASP.NET | 微软全栈 |",
    "| Web 层 | jQuery/Prototype/Ext JS/AJAX | 前端异步交互 |",
]
T_OLTP = [
    "| 对比项 | OLTP | OLAP |",
    "|--------|------|------|",
    "| 目的 | 日常事务处理 | 决策分析支持 |",
    "| 操作 | 增删改查 | 多维分析 |",
    "| 数据 | 当前、细节级 | 历史、汇总级 |",
    "| 用户 | 操作人员 | 决策层/分析员 |",
]
T_PDM = [
    "| 对比项 | PDM | PLM |",
    "|--------|-----|-----|",
    "| 定位 | 产品数据管理（图档/文档/BOM） | 产品全生命周期管理 |",
    "| 范围 | 研发设计阶段数据 | 需求→设计→制造→维护→退市 |",
    "| 关系 | PLM 包含并扩展 PDM | PLM 是 PDM 的超集 |",
]
T_BPR = [
    "| 对比项 | BPR | BPI |",
    "|--------|-----|-----|",
    "| 变革程度 | 根本性/彻底性 | 渐进式 |",
    "| 风险 | 高 | 低 |",
    "| 适用 | 流程严重落后 | 局部优化 |",
]
T_RUP = [
    "| 对比项 | RUP | 敏捷 |",
    "|--------|-----|------|",
    "| 驱动 | 用例驱动、以架构为中心 | 价值观驱动、拥抱变化 |",
    "| 迭代 | 阶段门限（先启/精化/构建/移交） | 小迭代、持续交付 |",
    "| 文档 | 重文档与规程 | 轻文档、重可工作软件 |",
]
T_RAD = [
    "| 对比项 | RAD | 瀑布 |",
    "|--------|-----|------|",
    "| 周期 | 快速应用开发、组件化并行 | 线性顺序、阶段串行 |",
    "| 需求 | 基本明确且可组件化 | 明确且稳定 |",
    "| 交付 | 快速出原型/增量 | 末尾一次性交付 |",
]
T_EV = [
    "| 对比项 | PV | EV | AC |",
    "|--------|----|----|----|",
    "| 含义 | 计划价值：到某时点计划完成工作的预算值 | 挣值：实际完成工作的预算值 | 实际成本：实际完成工作的实际花费 |",
    "| 口诀 | 计划要做多少 | 实际做了多少（值多少钱） | 实际花了多少 |",
]
T_CONF = [
    "| 对比项 | 配置管理 | 变更管理 |",
    "|--------|----------|----------|",
    "| 目的 | 标识配置项、建立并控制基线，保证可追溯 | 对基线变更进行申请、评估、审批与实施控制 |",
    "| 关注 | 配置项状态与版本 | 变更请求（CR）与审批流程 |",
    "| 活动 | 配置标识/配置审计/状态报告 | 申请→评估→CCB 决策→实施验证 |",
]
T_NPV = [
    "| 对比项 | NPV | NPVR |",
    "|--------|-----|------|",
    "| 含义 | 净现值：逐年净现金流折现求和的绝对收益 | 净现值率：NPV ÷ 投资现值 |",
    "| 用途 | 同规模方案绝对收益比较 | 不同规模方案投资效率排序 |",
]
T_FW = [
    "| 对比项 | 防火墙 | VPN | IDS |",
    "|--------|--------|-----|-----|",
    "| 功能 | 边界访问控制/隔离 | 公网上建加密隧道 | 入侵检测与告警 |",
    "| 部署 | 内外网边界 | 网关/端点 | 关键网段旁路 |",
]
T_SSL = [
    "| 对比项 | SSL | IPSec |",
    "|--------|-----|-------|",
    "| 层次 | 传输层与应用层之间 | 网络层 |",
    "| 特点 | HTTPS（端到端应用安全） | 端对端/主机到主机，透明加密 |",
]
T_BLP = [
    "| 对比项 | BLP(保密) | Biba(完整) |",
    "|--------|-----------|------------|",
    "| 目标 | 保密性：不上读/不下写 | 完整性：不下读/不上写 |",
]
T_DAC = [
    "| 对比项 | DAC | MAC | RBAC |",
    "|--------|-----|-----|------|",
    "| 授权依据 | 属主自主授权 | 系统强制安全标签 | 角色—权限映射 |",
    "| 灵活性 | 高 | 低 | 中 |",
    "| 典型缺陷 | 权限扩散 | 管理复杂 | 角色爆炸 |",
]
T_INDEP = [
    "| 对比项 | 逻辑独立性 | 物理独立性 |",
    "|--------|------------|------------|",
    "| 不影响 | 外模式改变不影响应用程序 | 内模式改变不影响模式与应用程序 |",
]
T_BITA = [
    "| 对比项 | BITA | EITA |",
    "|--------|------|------|",
    "| 侧重 | 业务与IT对齐 | 企业IT架构 |",
    "| 适用 | IS不能满足业务 | 架构规划 |",
]
T_TFD = [
    "| 对比项 | TFD | DFD |",
    "|--------|-----|-----|",
    "| TFD vs DFD | 业务“流水账”，6种符号 | 系统功能，4种符号，分层分解 |",
]
T_ENTITY = [
    "| 对比项 | 内部实体 | 外部实体 |",
    "|--------|----------|----------|",
    "| 内部实体 vs 外部实体（TFD） | 参与处理 | 仅传递/接收信息 |",
]
T_LOGIC = [
    "| 对比项 | 逻辑 DFD | 物理 DFD |",
    "|--------|----------|----------|",
    "| 逻辑 DFD vs 物理 DFD | 描述系统应做什么的抽象功能模型，不含实现细节 | 描述系统如何实现，含技术、设备与存储细节；前者用于需求分析，后者衔接设计与实现 |",
]
T_BEN = [
    "| 对比项 | NPV | NPVR |",
    "|--------|-----|------|",
    "| NPV vs NPVR | 绝对收益 | 投资效率 |",
]
ORPHAN = ["| 对比 | 区别 |", "|-----|------|"]

# ---------- 精确替换表 ----------
OPS: dict[str, list[tuple[list[str], list[str]]]] = {
    "kp-1-1.md": [
        (["| 对比项 | DAS | NAS | SAN |", "|--------|-----|-----|-----|", "| 连接 |"], T_DAS),
    ],
    "kp-1-2.md": [
        (ORPHAN + ["| 对比项 | DRAM | SRAM | ROM |", "| 对比项 | DAS | NAS | SAN |"],
         T_DRAM + [""] + T_DAS),
    ],
    "kp-1-3.md": [
        (ORPHAN + ["| 对比项 | 程序查询 | 中断 | DMA |"], T_IO),
    ],
    "kp-1-4.md": [
        (ORPHAN + ["| 对比项 | CISC | RISC |"], T_CISC),
    ],
    "kp-1-4-2.md": [
        (["| Java EE | Spring + Struts +"], T_STACK),
    ],
    "kp-2-2.md": [
        (ORPHAN, []),
    ],
    "kp-3-6.md": [
        (ORPHAN + ["| 对比项 | OLTP | OLAP |"], T_OLTP),
    ],
    "kp-4-3.md": [
        (ORPHAN, []),
        # 两表之间补空行由通用规则处理
    ],
    "kp-4-4.md": [
        (["| 对比项 | BPR | BPI |", "| 变革程度 | 根本性/彻底性 | 渐进式 |"],
         ["| 对比项 | BPR | BPI |", "|--------|-----|-----|", "| 变革程度 | 根本性/彻底性 | 渐进式 |"]),
        (["| 对比项 | BI | DSS |", "| 数据 | 历史海量 | 模型+数据 |"],
         ["| 对比项 | BI | DSS |", "|------|------|------|", "| 数据 | 历史海量 | 模型+数据 |"]),
        (["| 对比项 | BITA | EITA |", "|--------|-----"], T_BITA),
        (ORPHAN + ["| 对比项 | PDM | PLM |"], []),
    ],
    "kp-4-7.md": [
        (ORPHAN + ["| 对比项 | BPR | BPI |"], T_BPR),
    ],
    "kp-5-1.md": [
        (["| 本篇要点 | 对应章节 |", "|-"],
         ["| 本篇要点 | 对应章节 |", "|----------|----------|",
          "| SOA、ESB 对比 | 第6章 EAI；第12章 SOA |",
          "| 容器、DevOps | 第4章 云计算；第8章 项目管理 |",
          "| 分布式事务 | 第5章 并发；案例常考最终一致性 |",
          "| 设计模式 | 第13章 设计模式 |",
          "| API 安全 | 第9章 认证、PKI |",
          "| 测试 | 第14章 集成/系统测试 |"]),
    ],
    "kp-5-2.md": [
        (ORPHAN + ["| 对比项 | RUP | 敏捷 |", "| 对比项 | RAD | 瀑布 |"],
         T_RUP + [""] + T_RAD),
    ],
    "kp-6-4.md": [
        (ORPHAN + ["| 对比项 | PV | EV | AC |"], T_EV),
    ],
    "kp-6-5.md": [
        (ORPHAN + ["| 对比项 | 配置管理 | 变更管理 |"], T_CONF),
    ],
    "kp-6-9.md": [
        (["| 对比项 | 配置管理 | 变更管理 |", "| 目的 | 验收可交付 | 管理变更 |"], T_CONF),
    ],
    "kp-7-3.md": [
        (["| 对比项 | 防火墙 | VPN | IDS |", "| 对比项 | SSL | IPSec |", "| 特点 | HTTPS | 端对端 |"],
         T_FW + [""] + T_SSL),
    ],
    "kp-7-4.md": [
        (["| 对比项 | BLP(保密) | Biba(完整) |", "| 对比项 | DAC | MAC | RBAC |",
          "| 功能 | 访问控制/隔离 | 加密隧道 | 入侵检测 |"],
         T_BLP + [""] + T_DAC),
    ],
    "kp-8-5.md": [
        (ORPHAN, []),
        (["| TFD vs DFD | 业务“流水账”，6种符号 | 系统功能，4种符号，分层分解 |"], T_TFD),
        (["| 内部实体 vs 外部实体（TFD） | 参与处理 | 仅传递/接收信息 |"], [""] + T_ENTITY),
    ],
    "kp-8-6.md": [
        (ORPHAN, []),
        (["| TFD vs DFD | 业务“流水账”，6种符号 | 系统功能，4种符号，分层分解 |"], T_TFD),
        (["| 逻辑 DFD vs 物理 DFD | 逻辑 DFD 是描述系统应做什么的抽象功能模型，不含具体实现细节。 | 物理 DFD 是描述系统如何实现的模型，含具体技术、设备与存储等实现细节；前者用于需求分析，后者用于设计与实现衔接。 |"],
         [""] + T_LOGIC),
    ],
    "kp-8-8.md": [
        (ORPHAN + ["| NPV vs NPVR | 绝对收益 | 投资效率 |"], T_BEN),
    ],
    "kp-data-mgmt-analysis-modeling.md": [
        (ORPHAN + ["| 不影响 | 外模式/应用程序 | 模式/应用程序 |", "| 目的 | 日常事务 | 决策分析 |", "| 操作 | 增删改查 | 多维分析 |"],
         T_INDEP + [""] + T_OLTP),
    ],
}
BITA_FILES = [
    "kp-app-service-integration.md", "kp-data-integration-sharing.md", "kp-dss.md",
    "kp-ecommerce-egovernment.md", "kp-enterprise-informatization.md", "kp-tps.md",
]
for f in BITA_FILES:
    OPS.setdefault(f, []).append(
        (["| 对比项 | BITA | EITA |", "|--------|-----"], T_BITA)
    )

stats: Counter = Counter()
misses: list[str] = []


def apply_exact(lines: list[str], old: list[str], new: list[str], fname: str) -> list[str]:
    if not old:
        return lines
    n = len(old)
    for i in range(len(lines) - n + 1):
        if [l.strip() for l in lines[i : i + n]] == [l.strip() for l in old]:
            return lines[:i] + new + lines[i + n :]
    misses.append(f"{fname}: 未匹配 {' / '.join(old)[:60]}")
    return lines


def blank_between_tables(lines: list[str]) -> list[str]:
    out: list[str] = []
    for i, l in enumerate(lines):
        out.append(l)
        s = l.strip()
        nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
        if s.startswith("|") and not s.startswith("|-") and not s.startswith("| 对比项"):
            if nxt.startswith("| 对比项"):
                out.append("")
                stats["补表间空行"] += 1
        elif s.startswith("| 对比项") and nxt.startswith("| 对比项"):
            out.append("")
            stats["补表间空行"] += 1
    return out


def drop_empty_yh(lines: list[str]) -> list[str]:
    """删除正文为空的「## 易混辨析」节。"""
    idx = [i for i, l in enumerate(lines) if l.strip() == "## 易混辨析"]
    if not idx:
        return lines
    out = list(lines)
    removed = 0
    for i in reversed(idx):
        j = i + 1
        while j < len(out) and not out[j].strip():
            j += 1
        if j >= len(out) or out[j].startswith("## "):
            del out[i:j]
            removed += 1
    stats["删空易混辨析节"] += removed
    return out


def main() -> None:
    for fname, ops in OPS.items():
        p = POINTS / fname
        if not p.exists():
            misses.append(f"{fname}: 文件不存在")
            continue
        lines = p.read_text(encoding="utf-8").splitlines()
        for old, new in ops:
            lines = apply_exact(lines, old, new, fname)
            stats[f"替换:{fname}"] += 1
        lines = blank_between_tables(lines)
        lines = drop_empty_yh(lines)
        text = "\n".join(lines).rstrip("\n") + "\n"
        text = re.sub(r"\n{3,}", "\n\n", text)
        p.write_text(text, encoding="utf-8")
    print("统计:", dict(stats.most_common()))
    print("未匹配:", len(misses))
    for m in misses:
        print("  -", m)
    out = ROOT / "docs/kb-workshop/审计委员会/意见" / f"表修复-未匹配-{date.today().isoformat()}.json"
    out.write_text(json.dumps(misses, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()