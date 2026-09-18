/**
 * 可选云端同步：默认关闭；登录且开启后才 pull/push。
 * 冲突：Last-Write-Wins（云端 updated_at vs 本机 kv.updatedAt）。
 */
import {
  CASE_STORAGE_KEY,
  QUIZ_STORAGE_KEY,
  storageGet,
  storageGetMeta,
  storageSetQuiet,
} from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { mergeByUpdatedAt, pullProgress, pushProgress } from "@/lib/supabase/progress";

export const CLOUD_SYNC_FLAG_KEY = "cloud_sync_enabled";

const PUSH_DEBOUNCE_MS = 1500;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight: Promise<void> | null = null;

export async function isCloudSyncEnabled(): Promise<boolean> {
  const v = await storageGet<boolean>(CLOUD_SYNC_FLAG_KEY);
  return v === true;
}

export async function setCloudSyncEnabled(on: boolean): Promise<void> {
  await storageSetQuiet(CLOUD_SYNC_FLAG_KEY, on);
}

function canSync(): boolean {
  return isSupabaseConfigured() && Boolean(getSupabase());
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** 从本机组装待上传快照 */
async function readLocalPayload(): Promise<{ quiz: unknown; case_drafts: unknown }> {
  const quiz = (await storageGet(QUIZ_STORAGE_KEY)) ?? {};
  const case_drafts = (await storageGet(CASE_STORAGE_KEY)) ?? {};
  return { quiz, case_drafts };
}

/**
 * 登录且已开同步时：拉云端并按 LWW 应用到本机。
 * @returns 采用的一侧
 */
export async function pullAndApplyProgress(): Promise<"cloud" | "local" | "equal" | "skipped"> {
  if (!canSync()) return "skipped";
  if (!(await isCloudSyncEnabled())) return "skipped";

  const sb = getSupabase()!;
  const userId = await currentUserId();
  if (!userId) return "skipped";

  const cloud = await pullProgress(sb, userId);
  const quizMeta = await storageGetMeta(QUIZ_STORAGE_KEY);
  const caseMeta = await storageGetMeta(CASE_STORAGE_KEY);
  const decision = mergeByUpdatedAt({
    cloud,
    localQuizAt: quizMeta?.updatedAt ?? 0,
    localCaseAt: caseMeta?.updatedAt ?? 0,
  });

  if (decision === "cloud" && cloud) {
    await storageSetQuiet(QUIZ_STORAGE_KEY, cloud.quiz ?? {});
    await storageSetQuiet(CASE_STORAGE_KEY, cloud.case_drafts ?? {});
  } else if (decision === "local") {
    await pushProgressNow();
  }

  return decision;
}

/** 立即 upsert（需已登录且已开同步） */
export async function pushProgressNow(): Promise<boolean> {
  if (!canSync()) return false;
  if (!(await isCloudSyncEnabled())) return false;

  const sb = getSupabase()!;
  const userId = await currentUserId();
  if (!userId) return false;

  const payload = await readLocalPayload();
  await pushProgress(sb, userId, payload);
  return true;
}

/**
 * storageSet 后调用：仅 quiz/case key 触发 debounce push。
 */
export function scheduleCloudPush(key: string): void {
  if (key !== QUIZ_STORAGE_KEY && key !== CASE_STORAGE_KEY) return;
  if (!canSync()) return;

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushInFlight = (async () => {
      try {
        await pushProgressNow();
      } catch {
        /* 离线或 RLS 失败时静默；用户可点「立即同步」重试 */
      }
    })();
  }, PUSH_DEBOUNCE_MS);
}

export function flushCloudPush(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  return pushInFlight ?? Promise.resolve();
}
