# 题库网站 · 程序

> 现行基线：仓库根目录 Next.js 15（`output: "export"`）· 站点版本见 `package.json`  
> 设计：`../设计/` · 发布：`../发布/`

## 快速启动

```bash
cp .env.example .env.local   # 可选：填入 Supabase 公开配置
npm install
npm run dev                  # http://localhost:3000
```

静态导出预览：

```bash
npm run build
npx serve out
```

发版检查：

```bash
npm run check:release              # 版本 / 数据文件
npm run check:release -- --strict-out   # 另要求已有 out/
```

完整发布步骤见 [`../发布/静态托管发布清单.md`](../发布/静态托管发布清单.md)。

## 常用脚本

| 命令 | 作用 |
|------|------|
| `npm run sync:kb` | `content/kb/` → `public/kb/` + `kb-index` / 搜索索引 |
| `npm run sync:data` | 题库 / 案例 JSONL → `public/data/*.json` |
| `npm run sync:all` | 上述二者 |
| `npm run build` | sync:all + Next 静态导出 → `out/` |
| `npm run check:release` | 发版前静态校验 |

## 目录要点

```text
src/app/                 # App Router 页面
src/components/          # QuizApp / CaseApp / Kb* / ui(shadcn) / …
src/lib/                 # storage(IndexedDB) · cloud-sync · supabase · use-escape-key
public/data/             # questions / cases / release-notes / kb-*
public/kb/               # 正式知识点 Markdown（sync 产物）
content/banks/           # 题库源
content/workshop/new/    # 工坊通过题
content/kb/              # 知识点权威源（仅正式稿可 sync 挂站）
scripts/check-release.mjs
```

## 路由

| 路径 | 页面 |
|------|------|
| `/` | 刷题 |
| `/case/` | 案例分析 |
| `/kb/` · `/kb/[id]/` | 知识点目录 / 正文 |
| `/changelog/` | 更新日志 |
| `/about/` | 关于 |

进度默认 IndexedDB；登录且开启云同步后见 `supabase.md`。

## 浮层约定（v0.6+）

- 模态 / 抽屉：shadcn **Dialog** / **Sheet**（登录、更新提示、全局搜索、知识点预览）
- Esc：`src/lib/use-escape-key.ts`（固钉抽屉等）
- Toast：`.kb-toast` 固定定位，不进独立 Portal 通道  
- 历史 `src/components/portal/` 已移除（见本目录归档说明 `portal.md`）

## 版本更新通知

`public/data/release-notes.json`：`latest` 与 `releases[0]` 对齐 `package.json` version；用户首次见新版本弹窗。详情页 `/changelog/`。

## 与其他产出

| 来源 | 消费方式 |
|------|----------|
| `../设计/信息架构.md` | 导航与路由 |
| `../设计/页面说明.md` | 页面组件与空态 |
| `../设计/视觉与交互规范.md` | 主题令牌与 shadcn 用法 |
| `../发布/版本说明-*.md` · `静态托管发布清单.md` | 发版 |
| `supabase.md` | Auth / 同步 |

内容对错问题提工单至出题工坊 / 知识点工坊。
