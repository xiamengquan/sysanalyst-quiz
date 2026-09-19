# Supabase 接入说明

> 维护：网站程序 · 2026-09-18  
> 约束：本站 `next.config.ts` 为 `output: "export"` 静态导出，**仅使用浏览器端客户端**，不依赖 Next.js Server Actions / Route Handlers。

## 能力范围（第一期）

| 做 | 不做 |
|----|------|
| 邮箱密码登录 / 注册 + Magic Link | GitHub OAuth（表结构可后续加） |
| 可选云端同步刷题进度 + 案例草稿 | 题干 / 解析 / 知识点正文入库存 |
| 每用户一行 JSONB（`user_progress`） | 逐题明细大表、Storage Bucket |
| IndexedDB 本机优先；显式开启才上传 | 强制全员上云 |

额度：进度行通常 &lt; 200KB/用户，远低于 Free 500MB。

## 依赖

- `@supabase/supabase-js`
- 封装：`src/lib/supabase/`（`getSupabase` / `isSupabaseConfigured` / `progress`）
- 同步：`src/lib/cloud-sync.ts`
- UI：顶栏 `AuthButton`

## 1. 项目与环境变量

1. 在 [Supabase Dashboard](https://supabase.com/dashboard) 创建项目，复制 **Project URL** 与 **anon public** key  
2. 仓库根目录：

```bash
cp .env.example .env.local
# 编辑 .env.local 填入：
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY（或旧版 ANON_KEY）
npm run dev
```

3. 构建（EdgeOne 等）需在构建环境注入同名 `NEXT_PUBLIC_*` 变量

**禁止**把 `service_role` / `sb_secret_*` 放进前端或 `NEXT_PUBLIC_*`。

未配置时 `getSupabase()` 返回 `null`，刷题/案例仍走 IndexedDB。

## 2. Auth（邮箱密码 + Magic Link）

Dashboard → **Authentication** → **Providers** → **Email**：

1. 启用 Email provider  
2. 允许邮箱密码注册/登录（Email + Password）  
3. 「Confirm email」可按需要开关：开启则注册后须点确认邮件；关闭则可立即密码登录  

**URL Configuration**：

| 项 | 本地 | 线上（本站） |
|----|------|------|
| Site URL | `http://127.0.0.1:3000` | `https://maintruly.top` |
| Redirect URLs | `http://127.0.0.1:3000/**` | `https://maintruly.top/**` |

前端登录框支持三种方式：**密码登录 / 注册 / Magic Link**。Magic Link 回到任意页即可恢复会话（`detectSessionInUrl`）。

## 3. 建表与 RLS

在 Dashboard → **SQL Editor** 执行：

[`supabase/migrations/001_user_progress.sql`](../../../supabase/migrations/001_user_progress.sql)

表 `public.user_progress`：

- `user_id` → `auth.users(id)`
- `quiz` jsonb ← IndexedDB `sysanalyst_quiz_v4`
- `case_drafts` jsonb ← IndexedDB `sysanalyst_case_v1`
- `updated_at` 用于与本机 `updatedAt` 做 Last-Write-Wins

RLS：仅 `auth.uid() = user_id` 可 select/insert/update。

## 4. 同步策略

```text
默认：只写 IndexedDB
登录 + 用户打开「云同步」→ 允许上传/下载
本机 storageSet(quiz|case) 成功后 debounce 1.5s upsert
进入站点已登录且已开同步 → pull；云端 updated_at 与本机 kv.updatedAt 比较，较新者胜
```

冲突不做字段级三路合并。关闭「云同步」后不再自动上传（本机进度仍保留）。

## 5. 代码入口

```ts
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { pullAndApplyProgress, scheduleCloudPush } from "@/lib/cloud-sync";
```

顶栏：未配置 Supabase 时不展示登录；已配置则显示登录 / 邮箱 / 云同步开关 / 立即同步 / 退出。

## 6. 验证清单

### 本地

1. 填好 `.env.local`，执行 migration SQL，配置 Redirect URLs  
2. `npm run dev` → 顶栏出现登录  
3. 输入邮箱 → 收 Magic Link → 登录成功  
4. 打开「云同步」→ 刷几道题 → Network 可见对 `user_progress` 的 upsert  
5. 换无痕窗口（或清站点数据）→ 再登录并开启云同步 → 进度恢复  

### 线上

1. 构建环境注入 `NEXT_PUBLIC_SUPABASE_*`  
2. Auth Redirect 含正式域名  
3. 重复本地步骤 3–5  

### 负面路径

- 未配置 env：站点可用，无登录入口  
- 未开云同步：即使登录也不上传  
- 离线：本机 IndexedDB 照常写；恢复网络后「立即同步」或下次 debounce 上传  
