/** 从知识点页等跳转到首页刷题时的 URL 参数约定。 */
export type QuizDeepLinkOpts = {
  bank?: "practice" | "real" | "workshop" | "all";
  chapter?: number;
  /** 在题干/考点标签中模糊匹配 */
  q?: string;
  path?: "all" | "scenario";
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
  if (path === "all" || path === "scenario") out.path = path;
  return out;
}
