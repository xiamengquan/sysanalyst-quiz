/**
 * 系统分析师机考时间安排（站点备考提示，具体以准考证与考场系统为准）。
 * 2026 起：上午综合知识与案例分析连续机考；综合知识可提前 30 分钟交卷后直接进入案例。
 */

/** 统考日开考时刻（上午场） */
export const EXAM_MORNING_START_HOUR = 8;
export const EXAM_MORNING_START_MINUTE = 30;

/** 综合知识（选择题）答题上限（分钟） */
export const EXAM_CHOICE_MAX_MINUTES = 150;

/** 综合知识最早可提前交卷（距上限提前的分钟数） */
export const EXAM_CHOICE_EARLY_SUBMIT_BEFORE_MAX_MINUTES = 30;

/** 综合知识满此分钟数即可交卷进入案例（150 - 30 = 120） */
export const EXAM_CHOICE_MIN_MINUTES_BEFORE_SUBMIT =
  EXAM_CHOICE_MAX_MINUTES - EXAM_CHOICE_EARLY_SUBMIT_BEFORE_MAX_MINUTES;

export const EXAM_SCHEDULE_SUMMARY =
  "上午综合知识与案例分析连续机考；选择题最长 150 分钟，满 120 分钟可提前交卷，交卷后立即进入案例分析。";
