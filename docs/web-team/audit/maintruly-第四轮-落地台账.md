# maintruly.top 第四轮审计 · 落地台账

> **日期**：2026-10-08 · **版本**：v0.9.53

| 工单 | 优先级 | 状态 | 落地说明 |
|------|--------|------|----------|
| 1 sitemap 可访问 | P0 | ✅ | 正确 URL `/sitemap.xml` 线上 200；尾斜杠 404 → v0.9.52 `edgeone.json` 301；sitemap 改 **仅 canonical**（v0.9.53） |
| 2 专业英语 | P1 | ✅ | 重写 `kp-english-reading-terms`（术语表 + V&V + 阅读步骤） |
| 3 案例系统设计 | P1 | ✅ | 加厚 `案例系统设计类-答题Checklist`（组件/接口/数据模型） |
| 4 论文框架 | P1 | ✅ | 更新 `论文方向写作索引` + 新增 `企业架构-TOGAF与Zachman-论文素材卡` |
| 5 交叉链接 | P2 | ✅ | `kp-software-lifecycle`、`kp-7-4`、`kp-3-1` 等「相关考点」补链 |
| 6 数学与工程 | P2 | ✅ | `kp-math-stats-graph-theory-decision` 补图论/决策树/线性规划/运筹 |
| 7 知识产权 | P2 | ✅ | `kp-standards-ip-lifecycle` 期限表；`kp-law-finance-org-hr-it-audit` 纠偏重写 |

## 验收

```bash
npm run sync:all && npm run check:release
npm run check:live-seo   # 部署 edgeone 后
```
