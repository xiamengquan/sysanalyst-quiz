# 系统分析师 · 刷题站（Next.js）

软考「系统分析师」备考站点：**题库 + 案例 + 知识点** 同源入库，静态导出可部署 EdgeOne Makers。

## 功能

- **刷题**：自编 / 真题 / 出题工坊；筛选、连续通关、IndexedDB 进度
- **案例**：100 套案例分析练习卡
- **知识点**：正式精炼站内阅读 + 标题/正文快速搜索
- **配套服务**：内容源、合并脚本、出题/知识点工坊文档均在本仓库

## 目录

```
content/          # 源：知识点、题库 JSONL、案例 MD、工坊新题
public/           # 构建产物：data/*.json + kb/**
scripts/          # sync-kb / sync-data / build-kb-search / python/*
docs/             # 知识点工坊、出题工坊、网站小组文档
src/              # Next.js 前端
```

## 常用命令

```bash
npm install
npm run sync:all      # 知识点 + 题库/案例 → public/
npm run dev           # http://localhost:3000
npm run build         # 静态导出 → out/
```

分项：

| 脚本 | 作用 |
|------|------|
| `npm run sync:kb` | `content/kb` → `public/kb` + 搜索索引 |
| `npm run sync:data` | 合并选择题 / 构建案例 JSON |
| `npm run build:kb-search` | 仅重建知识点搜索索引 |

Python 辅助（仓库相对路径）：

- `scripts/python/build_cases_jsonl.py`
- `scripts/python/merge_to_quiz.py`
- `scripts/python/rewrite_cases_v2.py`
- `scripts/python/audit_practice.py`

## 部署（EdgeOne Makers）

1. 导入 GitHub 仓库 [xiamengquan/sysanalyst-quiz](https://github.com/xiamengquan/sysanalyst-quiz)
2. 构建：`npm run build`（输出 `out/`，见 `edgeone.json`）
3. push `main` 自动重新部署

## 合规

仅供个人学习；真题内容请勿商用或二次传播。
