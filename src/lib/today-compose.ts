/**
 * 今日任务合成器 · 连错自动入池（P0-A2）
 *
 * 把答题轨道（/track）中 wrong ≥ 阈值的「连错考点」自动注入当日午休「真题重刷」块，
 * 使错题二刷从人工标注变为系统排程——纠偏指令直达执行舱，焊死反馈回路最后一段。
 *
 * 约定：
 * - 纯函数 injectRetryTasks 由 TodayApp 与 se-system 共用，保证两侧基线一致；
 * - 仅对「今天」注入（历史日次基线保持稳定，last7/streak 不被追溯性污染）；
 * - today-compose 不 import se-system（se-system 反向依赖本模块），存键字符串与 RecallApp 同例本地维护。
 */

import { buildFallbackTasks, buildTodayTasks, type TodayTasks } from "@/lib/today-plan";
import { storageGet } from "@/lib/storage";

/** 与 se-system / RecallApp 同键：答题轨道点级记录 */
const TRACK_STORAGE_KEY = "sysanalyst_track_v1";

/** 连错阈值：wrong ≥ 2 视为「连错」，自动入池 */
export const RETRY_WRONG_THRESHOLD = 2;

export type RetryPoint = { pid: string; title: string; courseId: string };

type TrackPointsLike = Record<string, { wrong?: number } | undefined>;

/** 自动入池任务 id（与日期绑定，勾选状态稳定） */
export function retryTaskId(date: string): string {
  return `${date}-retry-auto`;
}

/**
 * 纯函数：把连错考点合成一条任务追加到当日午休块尾部。
 * 多个连错点合并为一条任务（文案列点 + 直达第一个点），排序保证 id/文案稳定。
 */
export function injectRetryTasks(tasks: TodayTasks, date: string, retryPoints: RetryPoint[]): TodayTasks {
  if (!retryPoints.length) return tasks;
  const sorted = [...retryPoints].sort((a, b) => a.pid.localeCompare(b.pid));
  const task = {
    id: retryTaskId(date),
    slot: "lunch" as const,
    text: `连错回炉（自动入池）：${sorted.map((p) => p.title).join("、")}——轨道二刷，答对追平即解除风险`,
    href: `/track/?point=${encodeURIComponent(sorted[0].pid)}`,
    link: "轨道回炉",
  };
  return {
    ...tasks,
    groups: tasks.groups.map((g) => (g.slot === "lunch" ? { ...g, tasks: [...g.tasks, task] } : g)),
  };
}

/** 从轨道数据中筛出连错点（tracks.json + 点级记录 → RetryPoint 列表） */
export function pickRetryPoints(
  tracks: { courses?: { id: string; units?: { points?: { id: string; title: string }[] }[] }[] } | null,
  points?: TrackPointsLike
): RetryPoint[] {
  if (!tracks?.courses || !points) return [];
  const out: RetryPoint[] = [];
  for (const c of tracks.courses) {
    for (const u of c.units ?? []) {
      for (const p of u.points ?? []) {
        if ((points[p.id]?.wrong ?? 0) >= RETRY_WRONG_THRESHOLD) {
          out.push({ pid: p.id, title: p.title, courseId: c.id });
        }
      }
    }
  }
  return out;
}

/**
 * 异步加载当日任务（含连错注入）：TodayApp 数据入口。
 * 非「今天」或轨道数据不可用时，退回纯静态基线。
 */
export async function loadComposedTasks(date: string, today: string): Promise<TodayTasks> {
  const base = buildTodayTasks(date) ?? buildFallbackTasks(date);
  if (date !== today) return base;
  try {
    const [tracks, rec] = await Promise.all([
      fetch("/data/tracks.json")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      storageGet<{ points?: TrackPointsLike }>(TRACK_STORAGE_KEY).catch(() => null),
    ]);
    return injectRetryTasks(base, date, pickRetryPoints(tracks, rec?.points));
  } catch {
    return base;
  }
}
