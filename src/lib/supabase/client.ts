import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * 浏览器端 Supabase 客户端（本站 `output: "export"`，无服务端中间件）
 *
 * - 未配置环境变量时返回 `null`，调用方需降级（继续用 IndexedDB 等本机能力）
 * - 单例：避免热更新重复创建
 */
let browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;

  const { url, anonKey } = getSupabaseEnv();
  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });
  return browserClient;
}

export { isSupabaseConfigured } from "@/lib/supabase/env";
