# Content source of truth

本目录为刷题站**可编辑源**，经 `npm run sync:all` 生成 `public/` 运行时产物。

| 路径 | 说明 |
|------|------|
| `kb/` | 知识点精炼正式 Markdown（32 篇） |
| `kb-index.json` | 知识点目录索引 |
| `banks/practice/` | 自编选择题 `all.jsonl` + 分章 MD |
| `banks/real/` | 上午真题 JSONL |
| `banks/cases/` | 案例分析 `案例001–100.md` |
| `workshop/new/` | 出题工坊新题 JSONL |
| `workshop/review/` | 评审报告与 reject 列表 |

不直接由浏览器读取本目录；请勿把未审计草稿写入 `public/`。
