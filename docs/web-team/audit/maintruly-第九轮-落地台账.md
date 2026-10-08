# maintruly.top 第九轮审计 · 落地台账

> **日期**：2026-10-08 · **版本**：v0.9.56 · **说明**：sitemap 项按约定忽略

| 工单 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| 1 kp-数据库 | P1 | ✅ | `kp-数据库`/`kp-database` → `kp-3-1`；速查 `考纲模块导航-数据库系统.md` |
| 2 其他 slug | P1 | ✅ | `kp-信息安全`→`kp-security-data-system`；`kp-专业英语`→`kp-english-reading-terms`；`kp-数学与工程基础`→`kp-math-stats-graph-theory-decision` 等 |
| 3 案例系统设计 | P1 | ✅ | Checklist 加厚集中式/分布式/微服务；回链 CAP |
| 4 分布式一致性与容错 | P2 | ✅ | `kp-2-5` 补 BASE、2PC/3PC/TCC、Paxos/Raft 要点 |
| 5 项目管理实战 | P2 | ✅ | `kp-6-4` 补 BAC/VAC/TCPI、EMV/CPM 指引 |
| 6 架构评估 | P2 | ✅ | `kp-10-6` 重写 SAAM/ATAM 步骤与质量属性六要素流程 |
| 7 粒度拆分 | P2 | ✅ | 新增考纲模块导航（数据库/软件工程/系统架构）+ 既有 `kp-3-*`/`kp-7-*`/`kp-10-*`/`kp-12-*` 细分，不拆索引 id |

## 验证

- `/kb/kp-数据库/` → `/kb/kp-3-1/`
- `/kb/kp-专业英语/` → `/kb/kp-english-reading-terms/`
- `npm run sync:all && npm run check:release`
