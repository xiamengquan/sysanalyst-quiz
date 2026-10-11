/**
 * 随机问答 · 莱特纳盒（对齐《记忆强化卡组》1-2-4-7-15 间隔）
 * box 0 = 新卡；box 1–5 分别隔 1/2/4/7/15 天后再出现。
 */

export type Flashcard = {
  id: string;
  /** 总册日次 d1–d7；null = 未映射（仅进「全部」池） */
  day: string | null;
  /** M = 总册必会默写卡；K = 记忆卡组硬记忆点（重点） */
  tier: "M" | "K";
  /** ★ 错卡高发 */
  hard: boolean;
  front: string;
  back: string;
  src: { href: string; label: string };
};

export type FlashcardsData = {
  meta: { builtAt: string; total: number; m: number; k: number; hard: number };
  cards: Flashcard[];
};

export const RECALL_STORAGE_KEY = "sysanalyst_recall_v1";
export const RECALL_INTERVALS_DAYS = [1, 2, 4, 7, 15] as const;
export const MAX_BOX = RECALL_INTERVALS_DAYS.length;

export type RecallGrade = "forgot" | "fuzzy" | "known";

export type RecallCardState = { box: number; lastAt: number };

export type RecallState = {
  /** 卡 id → 盒级与上次复习时间 */
  progress: Record<string, RecallCardState>;
  /** 今日已复习（按本地日期键） */
  today?: { date: string; count: number };
};

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DAY_MS = 86_400_000;

/** 是否到期（新卡永远视为到期；毕业卡按最长 15 天循环保温） */
export function isCardDue(card: Flashcard, state: RecallState, now = Date.now()): boolean {
  const p = state.progress[card.id];
  if (!p) return true;
  const interval = RECALL_INTERVALS_DAYS[Math.min(p.box, MAX_BOX) - 1] ?? 15;
  return now - p.lastAt >= interval * DAY_MS;
}

/** 自评 → 更新盒级：忘了回 1 盒；模糊原地（至少 1 盒）；记住升 1 盒（封顶毕业） */
export function applyGrade(
  state: RecallState,
  card: Flashcard,
  grade: RecallGrade,
  now = Date.now()
): RecallState {
  const prev = state.progress[card.id];
  const box =
    grade === "forgot"
      ? 1
      : grade === "fuzzy"
        ? Math.max(prev?.box ?? 1, 1)
        : Math.min((prev?.box ?? 0) + 1, MAX_BOX);
  const tk = todayKey();
  const todayCount = state.today && state.today.date === tk ? state.today.count + 1 : 1;
  return {
    progress: { ...state.progress, [card.id]: { box, lastAt: now } },
    today: { date: tk, count: todayCount },
  };
}

/** 盒级分布（含新卡计数） */
export function boxDistribution(cards: Flashcard[], state: RecallState) {
  const boxes = new Array(MAX_BOX + 1).fill(0) as number[];
  for (const c of cards) {
    const p = state.progress[c.id];
    boxes[p ? Math.min(p.box, MAX_BOX) : 0] += 1;
  }
  return boxes;
}

export function newRecallState(): RecallState {
  return { progress: {} };
}