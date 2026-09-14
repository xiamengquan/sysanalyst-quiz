# 工程内 Agent Skills

本目录为 Cursor **项目级**技能（`.cursor/skills/`），覆盖出题工坊、知识点工坊、题库网站小组。与个人技能 `~/.cursor/skills/sysanalyst-*` 同名时，以本仓库为准。

## 索引

| 组织 | Skill | 职责 |
|------|-------|------|
| 出题工坊 | `sysanalyst-analyst` | 分析真题规律 → 细则草稿 |
| 细则审计委员会 | `sysanalyst-committee-{a,b,c,chair}` | 审计/发布正式细则 |
| 出题工坊 | `sysanalyst-setter` | 按正式细则出新题 |
| 出题工坊 | `sysanalyst-reviewer` | 按正式细则审题 |
| 出题工坊 | `sysanalyst-hint-officer` | 对错提示文案质检 |
| 知识点编制委员会 | `sysanalyst-kb-editor-{a,b,c}` | 统稿 / 考点 / 应试钩子 |
| 知识点审计委员会 | `sysanalyst-kb-auditor-{a,b,c}` + `sysanalyst-kb-chair` | 审计 / 正式发布 |
| 网站小组 | `sysanalyst-web-{design,dev,pm}` | 设计 / 程序 / 协调 |

## 路径约定（相对仓库根）

| 用途 | 路径 |
|------|------|
| 知识点正文 | `content/kb/` |
| 练习/真题库 | `content/banks/` |
| 工坊新题 | `content/workshop/new/` |
| 出题工坊文档 | `docs/question-workshop/` |
| 知识点工坊文档 | `docs/kb-workshop/` |
| 网站小组文档 | `docs/web-team/` |
| 站点源码 | `src/` |
| 站点数据产物 | `public/data/`、`public/kb/` |

可读镜像（便于人工查阅，非 Cursor 自动加载）：`docs/*/agents/`、`docs/web-team/*/ROLE.md`。
