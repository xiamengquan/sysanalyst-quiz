# 英文阅读、领域术语

> **大纲**：全书英文缩写；第1章绪论 + 各科技术章 · **教程**：第1章 · **分组**：科目1 · 18. 专业英语 · **状态**：第四轮审计加厚 v0.9.53

## 概述

**专业英语**在综合知识中约占 **5 分**，题型多为 **短文阅读 + 术语/缩写辨析**。不要求翻译整篇，关键是：**抓主干（主语/转折/结论）→ 用中文考点对齐选项**。本页集中 **高频 IT 英文词与缩写**；绪论级概念（香农、霍尔方法论等）见 [第 1 章绪论考点](/kb/kp-1-1/)。

## 速懂

- **一句话**：先读 **首句+转折词（however/therefore）**，再查选项是否与 **软件工程/架构/项目管理/安全** 中文定义一致。
- **考什么**：缩写全称、近义词辨析（如 verification vs validation）、题干名词在教程中的标准译法。
- **答题顺序**：通读一遍 → 标生词/缩写 → 回选项排除「词义扩大/偷换主语」项 → 不确定时用中文考点反查。
- **别搞混**：**Verification（验证）**＝「是否做对」；**Validation（确认）**＝「是否做对的东西」。

## 定义

- **Algorithm**：算法；有限步骤、确定性、可终止的计算过程。**作用**：阅读题中常与 complexity、heuristic 同现。
- **Validation**：确认；评估产品是否满足 **用户真实需求**（需求层正确）。**作用**：与 V&V、测试阶段对应。
- **Verification**：验证；评估实现是否满足 **规格说明/设计**（构建过程正确）。**作用**：评审、检查、单元测试等。
- **Requirement / Specification**：需求 vs 规约；需求强调「要什么」，规约强调「可验证的表述」。**作用**：SRS、接口规约题。
- **Realism checks**：可行性/现实性检查；方案是否在技术、成本、进度上可落地。**作用**：架构/方案阅读题。
- **Throughput / Latency**：吞吐量 vs 延迟；性能阅读题常考二者 **权衡**。
- **Reliability / Availability**：可靠度 vs 可用性；与 **MTBF/MTTR** 中文考点一致。
- **Middleware / Framework / Platform**：中间件、框架、平台；集成与架构阅读题分层用词。

## 步骤与流程

### 英文阅读题（推荐 4 步）

1. **Skim**：读标题与每段首句，确定主题（需求/测试/安全/网络等）。
2. **Scan**：定位题干关键词在文中的 **同义替换**（如 maintainability ↔ 可维护性考点）。
3. **Match**：将选项与教程 **中文定义** 对齐，排除绝对化（only/must always）与无关扩展。
4. **Check**：若考缩写，先写 **全称** 再选（如 EVM = Earned Value Management）。

## 要点

### 高频缩写（综合知识）

| 缩写 | 英文全称 | 中文考点方向 |
|------|----------|--------------|
| SRS | Software Requirements Specification | 需求规约 |
| SDLC | Software Development Life Cycle | 软件生命周期 |
| OOA/OOD | Object-Oriented Analysis/Design | 面向对象 |
| UML | Unified Modeling Language | 建模语言 |
| API | Application Programming Interface | 接口/集成 |
| SOA | Service-Oriented Architecture | 服务架构 |
| REST | Representational State Transfer | Web 架构风格 |
| EVM | Earned Value Management | 挣值管理 |
| RTO/RPO | Recovery Time/Point Objective | 容灾指标 |
| ACL | Access Control List | 访问控制 |

### 易混词对

| 英文 | 易混 | 记忆 |
|------|------|------|
| Validation | Verification | Val→用户价值；Ver→规格符合 |
| Integrity | Confidentiality | 完整 vs 保密（CIA） |
| Synchronous | Asynchronous | 同步阻塞 vs 异步消息 |
| Coupling | Cohesion | 模块间 vs 模块内 |

## 易混辨析

| 对比项 | Verification | Validation |
|--------|--------------|------------|
| 问什么 | 是否按规格/设计实现 | 是否满足用户/业务需求 |
| 典型活动 | 评审、走查、单元测试 | 验收测试、UAT、原型确认 |

## 应试

- **阅读题**：题干多为软件工程/项目管理/架构/安全领域短文；先找主干与转折，再对选项。
- **术语题**：缩写与全称（如 SRS、EVM、SOA、RTO/RPO）；与中文考点定义对齐。
- **练题**：综合知识真题卷英文题占比稳定，可与第 1、7、8、12 章中文考点对照记忆。

- **本章练习热力**：教程第 1 章约 19 题（站点练习库，不含真题卷 ch=99）。
- **练题入口**：[第 1 章练习（关键词 英文阅读）](/?bank=practice&chapter=1&path=all&q=%E8%8B%B1%E6%96%87%E9%98%85%E8%AF%BB)

## 相关考点

- [第 1 章绪论（信息/系统/方法论）](/kb/kp-1-1/)
- [概率统计、图论、预测决策、数学建模、工程伦理](/kb/kp-math-stats-graph-theory-decision/)
- [标准类型、生命周期、知识产权](/kb/kp-standards-ip-lifecycle/)
- [需求工程](/kb/kp-requirements-engineering/)
- 速查：[前端友好-数学白话卡](../速查/前端友好-数学白话卡.md)
