/**
 * 随机问答 · 线上作答自动比对（纯前端，零依赖）
 *
 * 策略：把标准答案切成「关键点」token（剔除题面已含概念词、计数描述词与旧称括注），
 * 再统计用户答案对这些关键点的子串命中：
 *   全部命中 → correct；命中 ≥ 50% → partial；不足 → wrong；
 *   答案与标准答案规范化后全等直接 correct；无可判关键点 → manual（回退人工自评）。
 * 含 > 或 → 的关键点为顺序敏感点，要求在用户答案中按序整体出现（排序型口诀答乱序不算对）。
 */

export type MatchVerdict = "correct" | "partial" | "wrong" | "manual";

export type MatchResult = {
  verdict: MatchVerdict;
  /** 命中关键点数 / 总关键点数 */
  hits: number;
  total: number;
  hitTokens: string[];
  missTokens: string[];
};

const FULL2HALF: Record<string, string> = {
  "＞": ">",
  "＜": "<",
  "＝": "=",
  "＋": "+",
  "／": "/",
  "ｘ": "x",
  "×": "x",
  "？": "?",
  "！": "!",
  "：": ":",
  "；": ";",
  "，": ",",
  "（": "(",
  "）": ")",
};

/**
 * 规范化：全角转半角、去空白与装饰标点。
 * 保留 > < 以及公式字符（- + / 数字字母），供顺序敏感与公式比对。
 */
export function normalizeAnswer(s: string): string {
  let t = s;
  for (const [f, h] of Object.entries(FULL2HALF)) t = t.split(f).join(h);
  return t
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[『』「」"'`“”‘’·。．…—–_｜|〔〕【】]/g, "");
}

/** 关键点切分符：不含 > <（顺序语义）与 -（公式语义） */
const TOKEN_SPLIT = /[,，、;；。:：()（）[\]【】{}=+·？！?…「」『』]/;

const STOP_TOKENS = new Set([
  "用于",
  "表示",
  "说明",
  "描述",
  "定义",
  "作用",
  "答案",
  "要点",
  "如下",
  "以下",
  "其中",
  "以及",
  "并且",
  "然后",
  "属于",
  "包括",
  "进行",
  "可以",
  "对照",
  "填写",
  "默写",
  "分别",
]);

/** 计数描述词（三特点/四阶段/五级…）：题面通常已含，不参与判定 */
const COUNT_RE = /^[一二三四五六七八九十百0-9]{0,3}(条|点|个|种|类|阶段|步|项|层|级|大|特点|特性|原则|要素|性质|机制|方式|方法)$/u;

function tokensOf(back: string, frontNorm: string): string[] {
  const norm = normalizeAnswer(back);
  const out: string[] = [];
  for (const raw of norm.split(TOKEN_SPLIT)) {
    const t = raw.trim();
    if (!t) continue;
    if (/^旧称/.test(t)) continue; // 括注帮助信息，不参与判定
    if (t.length < 2 && !/[a-z0-9]/.test(t)) continue;
    if (STOP_TOKENS.has(t)) continue;
    if (t.length <= 6 && COUNT_RE.test(t)) continue;
    if (frontNorm.includes(t)) continue; // 题面已含的概念词（如「CMMI 五级」）
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * 比对用户答案与标准答案。
 * verdict: correct=关键点全命中/全等；partial=命中≥45% 或核心排序点命中；wrong=不足；manual=无可判关键点（回退人工）。
 */
export function judgeAnswer(front: string, back: string, user: string): MatchResult {
  const u = normalizeAnswer(user);
  const nb = normalizeAnswer(back);
  const tokens = tokensOf(back, normalizeAnswer(front));
  const empty = { hits: 0, total: tokens.length, hitTokens: [], missTokens: [] };
  if (!u) return { ...empty, verdict: "manual" };
  if (u === nb) return { ...empty, verdict: "correct" };
  if (!tokens.length) return { ...empty, verdict: "manual" };

  // 弱符号（书写习惯差异大）：匹配前双方剔除；> < → ← 为顺序语义，保留另处理
  const stripWeak = (s: string) => s.replace(/[/+=-]/g, "");
  const u2 = stripWeak(u);

  let hits = 0;
  let seqHit = false; // 是否命中了核心排序点（如「组合>聚合>关联>依赖」）
  const hitTokens: string[] = [];
  const missTokens: string[] = [];
  for (const t of tokens) {
    let hit: boolean;
    if (/[>→<←]/.test(t)) {
      // 顺序敏感点：按词序列在用户答案中依序出现（写法宽松、顺序严格）
      const seq = t
        .split(/[>→<←]/)
        .map(stripWeak)
        .filter((w) => w.length >= 2 || /[a-z0-9]/.test(w));
      if (seq.length) {
        let pos = 0;
        hit = seq.every((w) => {
          const i = u2.indexOf(w, pos);
          if (i < 0) return false;
          pos = i + w.length;
          return true;
        });
      } else {
        hit = u2.includes(stripWeak(t));
      }
      if (hit) seqHit = true;
    } else {
      hit = u2.includes(stripWeak(t));
    }
    if (hit) {
      hits += 1;
      hitTokens.push(t);
    } else {
      missTokens.push(t);
    }
  }
  const score = hits / tokens.length;
  let verdict: MatchVerdict =
    score >= 0.75 ? "correct" : score >= 0.45 ? "partial" : "wrong";
  // 核心排序点命中但整体不足：保底 partial（细节可改判）
  if (verdict === "wrong" && seqHit) verdict = "partial";
  return { verdict, hits, total: tokens.length, hitTokens, missTokens };
}