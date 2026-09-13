# Supabase 接入说明

> 维护：网站程序 · 2026-09-13  
> 约束：本站 `next.config.ts` 为 `output: "export"` 静态导出，**仅使用浏览器端客户端**，不依赖 Next.js Server Actions / Route Handlers。

## 依赖

- `@supabase/supabase-js`
- 封装：`src/lib/supabase/`（`getSupabase` / `isSupabaseConfigured`）

## 本地配置

1. 在 [Supabase Dashboard](https://supabase.com/dashboard) 创建项目，复制 **Project URL** 与 **anon public** key  
2. 仓库根目录：

```bash
cp .env.example .env.local
# 编辑 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

3. 构建（EdgeOne 等）需在构建环境注入同名 `NEXT_PUBLIC_*` 变量

**禁止**把 `service_role` key 放进前端或 `NEXT_PUBLIC_*`。

## 代码用法

```ts
"use client";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const sb = getSupabase();
if (!isSupabaseConfigured() || !sb) {
  // 未配置：继续 IndexedDB / 本地能力
} else {
  // const { data } = await sb.from("...").select();
}
```

未配置时 `getSupabase()` 返回 `null`，现有刷题进度/案例草稿仍走 IndexedDB，不阻塞站点。

## 后续可接（未实现）

| 能力 | 说明 |
|------|------|
| 登录 | Auth（邮箱 / OAuth），顶栏展示会话 |
| 云端进度 | 将 IndexedDB 进度同步到 `profiles` / `quiz_progress` 表 |
| RLS | 表级按 `auth.uid()` 隔离 |

先定表结构与 RLS，再写同步逻辑；本提交只完成 SDK 与配置骨架。
