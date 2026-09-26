# 知识点工坊 · 程序（Dev Docs 运维）

> 站点程序文档见 `docs/web-team/程序/README.md`（Next/sync/发版）。  
> 本文只讲 **知识点内容** 如何按 Dev Docs 模型编写、注册、同步挂站。

## 文档模型

→ [`文档模型.md`](./文档模型.md)（Explanation / Reference / Tutorial / How-to 与 `kind`、`docType` 对照）

## 快速命令

```bash
# 改完 content/kb 与 content/kb-index.json 后
npm run sync:kb

# 与题库一并导出前
npm run sync:all

# 发版（含知识点时必做）
npm run check:release
```

| 命令 | 作用 |
|------|------|
| `npm run sync:kb` | `content/kb/` → `public/kb/`；复制 `kb-index.json`；重建 `kb-search-index.json` |
| `scripts/build-kb-search.mjs` | 一般由 sync:kb 调用；单独调试搜索索引时用 |

## 目录要点

```text
content/kb/                    # 权威 Markdown（勿改 public/kb 手修）
content/kb-index.json          # 侧栏/目录注册表（id、kind、docType、chapter）
docs/kb-workshop/
  00-总章程.md                 # 双委员会流程
  编制委员会/答卷写法准则-v1.1.md
  编制委员会/模板-速查学习卡.md
  程序/                        # 本 Dev Docs 说明
  审计委员会/正式发布/         # 版本清单与公告
public/kb/                     # sync 产物
public/data/kb-index.json
public/data/kb-search-index.json
```

## 新增一篇速查/学习卡（Checklist）

1. 在 `content/kb/速查/` 创建 `.md`，文首按 [`模板-速查学习卡.md`](../编制委员会/模板-速查学习卡.md) 填写 `docType` 等  
2. 在 `content/kb-index.json` → `sections[id=quick].items` 追加条目（`id` 唯一、`path` 相对 `content/kb/`）  
3. 若属某章考点：在该章与 [`高频对比速查表`](../../../content/kb/速查/高频对比速查表.md) 加锚点/一行链接  
4. 更新 [`00-使用说明与知识地图`](../../../content/kb/00-使用说明与知识地图.md) 复习路径（若为用户主路径）  
5. 送审或按工坊章程审计 → `npm run sync:kb` → 发版日志  

## 新增/大改分章（chapter）

1. 遵循 [`答卷写法准则-v1.1.md`](../编制委员会/答卷写法准则-v1.1.md)  
2. 更新篇索引 `第N至M章.md` 与 `kb-index.json` 对应 `chapter` 号  
3. 知识地图 §2.2 与大纲考点对照保持一致  

## 与 Agent Skills

| 席位 | Skill | 本目录相关职责 |
|------|-------|----------------|
| 编制甲 | `sysanalyst-kb-editor-a` | 知识地图、`kb-index`、文档模型一致 |
| 编制乙 | `sysanalyst-kb-editor-b` | chapter 正文 Explanation |
| 编制丙 | `sysanalyst-kb-editor-c` | 速查 Reference / Tutorial / How-to 钩子 |
| 审计* | `sysanalyst-kb-auditor-*` | 对照文档模型与写法准则 |
| 主席 | `sysanalyst-kb-chair` | 发布后提醒 sync + 站点发版 |

## 常见问题

**Q：写了 Markdown 但站点搜不到？**  
A：未入 `kb-index.json` 或未 `sync:kb`。

**Q：tutorial 和 reference 都放在 `kind: quick`？**  
A：是。用 `docType` 区分；侧栏仍归「速查」区，复习路径在知识地图按 docType 引导。

**Q：REST、UML 这类卡算哪类？**  
A：体系化学习卡多为 `docType: reference`（兼教程自测节）；L0→L4 长路径为 `docType: tutorial`。
