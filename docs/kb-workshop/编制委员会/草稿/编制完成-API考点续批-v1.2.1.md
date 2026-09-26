# 编制完成 · API 考点续批 v1.2.1

| 字段 | 内容 |
|------|------|
| **日期** | 2026-09-26 |
| **依据** | 审计 v1.2 建议修改（非阻塞） |
| **程序** | `scripts/python/refine_kb_api_points.py` |

## 已完成

- 定义节：答卷句上提 + `DEF_OVERRIDES`（CMMI、IDE/CASE）
- 应试节：从章「应试钩子/常考」按关键词过滤
- 易混：无关键词匹配时不整表粘贴
- `ANCHOR_HINTS` 扩充与去重；`kp-9-4/9-5` 与 `kp-11-4/11-5` 分流
- 论文专题组 9 条 `title` 可读化
- 站点：默认筛「考点（API）」、组内 `outlineRef` 排序

## v1.2.2 / v1.2.3（已落地）

- `finalize_definitions` / `infer_definitions` / `dynamic_definition`：占位定义 **0**
- 概述弱句式修复；`check-kb-points.mjs` 发版门禁
- 站点：六节锚点、同组 prev/next

## 待 v1.2.4（可选）

- 约 45 篇「定义节偏短」可逐条改为完整「是/用于」答卷句（`DEF_OVERRIDES` 或人工）
