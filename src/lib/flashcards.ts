/**
 * 随机问答 · 间隔排程引擎 v2（P2-A6：FSRS 式自适应）
 * 基线仍对齐《记忆强化卡组》1-2-4-7-15 莱特纳阶梯；每卡按自评历史自适应伸缩间隔
 * （ease 0.6–1.6）并给出保持率预测 R = 2^(-已过天数/半衰期)。box 0 = 新卡；box 1–5 基线隔 1/2/4/7/15 天。
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

/**
 * 间隔排程引擎 v2 · FSRS 式自适应（P2-A6）
 *
 * 基线仍为 1-2-4-7-15 莱特纳阶梯；每卡新增两个可选字段（旧进度数据缺省即默认值，零迁移）：
 *  - ease   间隔伸缩系数：记住 ×1.05 / 模糊 ×0.9 / 忘了 ×0.8，夹在 0.6–1.6——「记得牢就拉长，记得虚就缩短」
 *  - streak 连对计数：记住 +1，忘了清零（连续答对越多，间隔拉得越长）
 * 到期判定与保持率预测共用一条半衰曲线：R = 2^(-已过天数 / 半衰期)，半衰期 = 基线间隔 × ease，
 * 即到期日 = 预测保持率降至 50% 之时。
 */
export type RecallCardState = { box: number; lastAt: number; ease?: number; streak?: number };

export const EASE_MIN = 0.6;
export const EASE_MAX = 1.6;
export const EASE_DEFAULT = 1;
/** 到期阈值：预测保持率低于该值的在册卡视为「记忆风险卡」 */
export const RETENTION_RISK = 0.7;

export type RecallState = {
  /** 卡 id → 盒级与上次复习时间 */
  progress: Record<string, RecallCardState>;
  /** 今日已复习（按本地日期键） */
  today?: { date: string; count: number };
};

function clampEase(e: number): number {
  return Math.max(EASE_MIN, Math.min(EASE_MAX, e));
}

/** 卡的间隔伸缩系数（旧数据缺省 = 1） */
export function easeOf(p?: RecallCardState): number {
  return p ? clampEase(p.ease ?? EASE_DEFAULT) : EASE_DEFAULT;
}

/** 盒级基线间隔（天）：1-2-4-7-15，毕业卡按最长 15 天循环保温 */
export function baseIntervalDays(box: number): number {
  return RECALL_INTERVALS_DAYS[Math.min(Math.max(box, 1), MAX_BOX) - 1] ?? 15;
}

/** 卡的实际排程间隔（天）= 基线间隔 × ease */
export function intervalDays(p: RecallCardState): number {
  return baseIntervalDays(p.box) * easeOf(p);
}

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DAY_MS = 86_400_000;

/** 是否到期：新卡永远视为到期；在册卡按「已过天数 ≥ 基线间隔 × ease」判定（毕业卡 15 天循环保温） */
export function isCardDue(card: Flashcard, state: RecallState, now = Date.now()): boolean {
  const p = state.progress[card.id];
  if (!p) return true;
  return (now - p.lastAt) / DAY_MS >= intervalDays(p);
}

/**
 * 预测保持率（0–1）：R = 2^(-已过天数 / 半衰期)，半衰期 = 排程间隔。
 * 无进度的卡返回 0（尚未进入可预测状态）。
 */
export function predictedRetention(p: RecallCardState | undefined, now = Date.now()): number {
  if (!p) return 0;
  const elapsed = Math.max(0, (now - p.lastAt) / DAY_MS);
  return Math.pow(0.5, elapsed / intervalDays(p));
}

/** 记忆保持率统计：在册卡的平均预测保持率 + 风险卡数（R < RETENTION_RISK） */
export function retentionStats(
  cards: Flashcard[],
  state: RecallState,
  now = Date.now()
): { avg: number; atRisk: number } {
  let sum = 0;
  let n = 0;
  let atRisk = 0;
  for (const c of cards) {
    const p = state.progress[c.id];
    if (!p) continue;
    const r = predictedRetention(p, now);
    sum += r;
    n++;
    if (r < RETENTION_RISK) atRisk++;
  }
  return { avg: n ? sum / n : 1, atRisk };
}

/** 自评 → 更新盒级与自适应参数：忘了回 1 盒并重罚 ease；模糊原地轻罚；记住升 1 盒并奖励（封顶毕业） */
export function applyGrade(
  state: RecallState,
  card: Flashcard,
  grade: RecallGrade,
  now = Date.now()
): RecallState {
  const prev = state.progress[card.id];
  const ease0 = prev?.ease ?? EASE_DEFAULT;
  const streak0 = prev?.streak ?? 0;
  const ease = clampEase(
    grade === "known" ? ease0 * 1.05 : grade === "fuzzy" ? ease0 * 0.9 : ease0 * 0.8
  );
  const streak = grade === "known" ? streak0 + 1 : grade === "fuzzy" ? streak0 : 0;
  const box =
    grade === "forgot"
      ? 1
      : grade === "fuzzy"
        ? Math.max(prev?.box ?? 1, 1)
        : Math.min((prev?.box ?? 0) + 1, MAX_BOX);
  const tk = todayKey();
  const todayCount = state.today && state.today.date === tk ? state.today.count + 1 : 1;
  return {
    progress: { ...state.progress, [card.id]: { box, lastAt: now, ease, streak } },
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