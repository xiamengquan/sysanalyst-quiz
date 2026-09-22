/**
 * 系统分析师考试倒计时计算逻辑
 * 考试日期：10月24日（软考下半年统一开考时间）
 */

export interface ExamCountdownInfo {
  /** 剩余天数（>=0） */
  days: number;
  /** 距离开考（当日 08:30）剩余总小时数 */
  totalHours: number;
  /** 目标考试年份 */
  targetYear: number;
  /** 目标考试完整日期格式化字符串，如 "2026年10月24日" */
  targetDateStr: string;
  /** 考试状态 */
  status: "upcoming" | "tomorrow" | "today" | "passed";
}

/**
 * 计算考试倒计时
 * @param month 考试月份（默认 10 月）
 * @param day 考试日期（默认 24 日）
 * @param examHour 开考小时（默认 8 点 30 分）
 */
export function getExamCountdown(month = 10, day = 24, examHour = 8, examMinute = 30): ExamCountdownInfo {
  const now = new Date();
  const currentYear = now.getFullYear();

  let targetYear = currentYear;
  // 计算当年的目标时间（上午开考）
  let targetExamTime = new Date(targetYear, month - 1, day, examHour, examMinute, 0);

  // 自然日零点基准
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let targetMidnight = new Date(targetYear, month - 1, day).getTime();

  // 若当年考试已过去超过 7 天，自动滚动计算下一年的考期
  const msPerDay = 1000 * 60 * 60 * 24;
  if (todayMidnight - targetMidnight > 7 * msPerDay) {
    targetYear += 1;
    targetExamTime = new Date(targetYear, month - 1, day, examHour, examMinute, 0);
    targetMidnight = new Date(targetYear, month - 1, day).getTime();
  }

  const diffDays = Math.round((targetMidnight - todayMidnight) / msPerDay);
  const diffMs = targetExamTime.getTime() - now.getTime();
  const totalHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  let status: ExamCountdownInfo["status"] = "upcoming";
  if (diffDays === 0) {
    status = "today";
  } else if (diffDays === 1) {
    status = "tomorrow";
  } else if (diffDays < 0) {
    status = "passed";
  }

  return {
    days: Math.max(0, diffDays),
    totalHours,
    targetYear,
    targetDateStr: `${targetYear}年${month}月${day}日`,
    status,
  };
}
