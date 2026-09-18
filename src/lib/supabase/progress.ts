import type { SupabaseClient } from "@supabase/supabase-js";

export type UserProgressRow = {
  user_id: string;
  quiz: unknown;
  case_drafts: unknown;
  updated_at: string;
};

export type ProgressSnapshot = {
  quiz: unknown;
  case_drafts: unknown;
  /** 云端 updated_at（ISO） */
  updatedAt: number;
};

/** 拉取当前用户进度；无行返回 null */
export async function pullProgress(
  sb: SupabaseClient,
  userId: string,
): Promise<ProgressSnapshot | null> {
  const { data, error } = await sb
    .from("user_progress")
    .select("user_id, quiz, case_drafts, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as UserProgressRow;
  return {
    quiz: row.quiz ?? {},
    case_drafts: row.case_drafts ?? {},
    updatedAt: Date.parse(row.updated_at) || 0,
  };
}

/** upsert 整行进度；返回服务端 updated_at 时间戳 */
export async function pushProgress(
  sb: SupabaseClient,
  userId: string,
  payload: { quiz: unknown; case_drafts: unknown },
): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("user_progress")
    .upsert(
      {
        user_id: userId,
        quiz: payload.quiz ?? {},
        case_drafts: payload.case_drafts ?? {},
        updated_at: now,
      },
      { onConflict: "user_id" },
    )
    .select("updated_at")
    .single();

  if (error) throw error;
  return Date.parse((data as { updated_at: string }).updated_at) || Date.now();
}

/**
 * Last-Write-Wins：比较云端 updatedAt 与本机 max(quizMeta, caseMeta)。
 * 返回应采用的一侧。
 */
export function mergeByUpdatedAt(args: {
  cloud: ProgressSnapshot | null;
  localQuizAt: number;
  localCaseAt: number;
}): "cloud" | "local" | "equal" {
  const localAt = Math.max(args.localQuizAt || 0, args.localCaseAt || 0);
  const cloudAt = args.cloud?.updatedAt || 0;
  if (!args.cloud || cloudAt <= 0) return "local";
  if (localAt <= 0) return "cloud";
  if (cloudAt > localAt) return "cloud";
  if (localAt > cloudAt) return "local";
  return "equal";
}
