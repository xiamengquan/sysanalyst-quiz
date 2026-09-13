/**
 * Supabase 环境变量（静态导出站点仅使用 NEXT_PUBLIC_*，构建时打入前端包）
 */
export function getSupabaseEnv() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
}
