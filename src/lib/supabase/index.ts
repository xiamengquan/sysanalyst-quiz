/**
 * Supabase 公共导出入口
 *
 * 用法（客户端组件）：
 * ```ts
 * import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
 * const sb = getSupabase();
 * if (!sb) { /* 未配置，走本机降级 *\/ }
 * ```
 */
export { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
export { getSupabaseEnv } from "@/lib/supabase/env";
