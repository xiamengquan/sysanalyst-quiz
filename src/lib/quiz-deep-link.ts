/** 从知识点页等跳转到首页刷题时的 URL 参数约定。 */
export type QuizDeepLinkOpts = {
  bank?: "practice" | "real" | "workshop" | "all";
  chapter?: number;
  /** 在题干/考点标签中模糊匹配 */
  q?: string;
  path?: "all" | "scenario" | "seven_day";
  /** 真题场次，如 2014上；仅真题系统使用 */
  year?: string;
  /** 七日巩固日次，如 d1；配合 path=seven_day */
  day?: string;
};

export function quizHomeHref(opts: QuizDeepLinkOpts = {}): string {
  const p = new URLSearchParams();
  p.set("bank", opts.bank ?? "practice");
  p.set("path", opts.path ?? "all");
  if (opts.chapter != null && opts.chapter >= 0) {
    p.set("chapter", String(opts.chapter));
  }
  const q = opts.q?.trim();
  if (q) p.set("q", q);
  if (opts.year?.trim()) p.set("year", opts.year.trim());
  return `/?${p.toString()}`;
}

export function parseQuizDeepLink(params: URLSearchParams): QuizDeepLinkOpts {
  const out: QuizDeepLinkOpts = {};
  const bank = params.get("bank");
  if (bank === "practice" || bank === "real" || bank === "workshop" || bank === "all") {
    out.bank = bank;
  }
  const ch = params.get("chapter");
  if (ch && /^\d+$/.test(ch)) out.chapter = Number(ch);
  const q = params.get("q");
  if (q?.trim()) out.q = q.trim();
  const path = params.get("path");
  if (path === "all" || path === "scenario" || path === "seven_day") out.path = path;
  const day = params.get("day");
  if (day && /^d[1-7]$/.test(day)) out.day = day;
  const year = params.get("year");
  if (year?.trim()) out.year = year.trim();
  return out;
}