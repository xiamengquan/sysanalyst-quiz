# 知识点 · API 参考模型

> 与「篇章合订」并行：**一个大纲考点 = 一篇独立 Markdown**，目录按大纲分组，交互类似 API Reference（左侧分组导航、右侧单页正文）。

## 与旧模型的关系

| 维度 | 篇章精炼（Legacy） | 考点参考 API（新） |
|------|-------------------|-------------------|
| 粒度 | 整章/速查长文 | **单考点一页** |
| 路径 | `content/kb/第N章-*.md` | `content/kb/points/kp-*.md` |
| 索引 `kind` | `chapter` / `quick` | **`point`** |
| 适用 | 系统阅读、通章复习 | 查定义、刷前速览、交叉链接 |

权威源仍为 `content/kb/`；`content/kb-index.json` 注册全部 `point` 条目。

## 单页结构（固定章节）

每篇 `points/kp-*.md` 须含以下二级标题（允许暂写「待编制」）：

1. **概述** — 1 段：考什么、常出题型  
2. **定义** — 答卷句「X 是…」「用于…」  
3. **要点** — 条列、表均可  
4. **易混辨析** — 与相邻考点对比  
5. **应试** — 选择/案例/论文钩子  
6. **相关考点** — 链接其它 `kp-*` 或正文章  

文首 blockquote：**大纲编号 · 教程章节 · 分组**（与 index 字段一致）。

## 索引字段（`kb-index.json`）

```json
{
  "id": "kp-2-7-web-service",
  "title": "Web 服务",
  "path": "points/kp-2-7-web-service.md",
  "kind": "point",
  "status": "正式|草稿",
  "group": "科目1 · 2. 计算机网络与分布式系统",
  "outlineRef": "2.7",
  "chapter": 4,
  "note": "教程 4.7"
}
```

## 生成与维护

```bash
python3 scripts/python/bootstrap_kb_api_points.py   # 自大纲对照 (re)生成骨架
python3 scripts/python/bootstrap_kb_api_points.py --merge-index
npm run sync:kb
```

人工补全正文后走工坊审计；**禁止**只在 `public/kb/points` 手改。

## 站点展示

- 目录页：类型筛 **「考点」**；`考点参考（API）` 分区按 `group` 折叠展示  
- 阅读页：顶栏面包屑 + 大纲/章号徽章；正文 API 式固定目录锚点  
