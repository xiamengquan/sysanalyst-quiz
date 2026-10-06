import type { KbItem } from "@/lib/types";

/**
 * 教程章（CH_NAMES 1–22）考试优先级序。
 * 依据：出题细则 §10.2 批次配额 + 优先补强章 5/7/9/10/12/14 + 案例/论文交叉。
 * 数值越小越优先（先学、先背）。
 */
const CHAPTER_RANK: Record<number, number> = {
  7: 0,
  11: 1,
  12: 2,
  5: 3,
  14: 4,
  8: 5,
  9: 6,
  10: 7,
  4: 8,
  3: 9,
  13: 10,
  15: 11,
  6: 12,
  2: 13,
  1: 14,
  16: 15,
  17: 16,
  18: 17,
  19: 18,
  20: 19,
  21: 20,
  22: 21,
};

const DEFAULT_RANK = 99;

export function examPriorityRank(chapter?: number): number {
  if (chapter == null) return DEFAULT_RANK;
  return CHAPTER_RANK[chapter] ?? DEFAULT_RANK;
}

export type ExamPriorityTier = "P0" | "P1" | "P2" | "P3";

export function examPriorityTier(chapter?: number): ExamPriorityTier {
  const r = examPriorityRank(chapter);
  if (r <= 7) return "P0";
  if (r <= 11) return "P1";
  if (r <= 13) return "P2";
  return "P3";
}

export function compareKbItemsByExamPriority(a: KbItem, b: KbItem): number {
  const dr = examPriorityRank(a.chapter) - examPriorityRank(b.chapter);
  if (dr !== 0) return dr;
  const outlineA = a.outlineRef ?? "";
  const outlineB = b.outlineRef ?? "";
  if (outlineA !== outlineB) return outlineA.localeCompare(outlineB, "zh-CN", { numeric: true });
  return a.title.localeCompare(b.title, "zh-CN");
}
