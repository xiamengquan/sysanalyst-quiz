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
  "−": "-", // U+2212 数学负号
};

/**
 * 规范化：全角转半角、去空白与装饰标点。
 * 保留 > < 以及公式字符（- + / 数字字母），供顺序敏感与公式比对。
 */
export function normalizeAnswer(s: string): string {
  let t = s;
  for (const [f, h] of Object.entries(FULL2HALF)) t = t.split(f).join(h);
  // 常见等义改写：卡面「此序」＝答题者自然语言「排序」（语义全等，不应判失分）
  t = t.split("此序").join("排序");
  return t
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[『』「」"'`“”‘’·。．…—–_｜|〔〕【】]/g, "");
}

/** 关键点切分符：含 /（中文列举分隔）与空白（词首字口诀匹配按原始串分词）；不含 > <（顺序语义）与 -（公式语义） */
const TOKEN_SPLIT = /[\s,，、;；。:：()（）[\]【】{}=+·？！?…「」『』\/]/;
const SEP_RE = new RegExp(TOKEN_SPLIT.source, "g");

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

/** 计数描述词（三特点/四阶段/五种/静态五种…）：修饰性计数，不参与判定 */
const COUNT_RE = /^[^0-9]*[一二三四五六七八九十百\d]{1,3}(种|类|条|点|个|阶段|步|项|层|级|大|特点|特性|原则|要素|性质|机制|方式|方法)$/u;

function tokensOf(back: string, frontNorm: string): string[] {
  const norm = normalizeAnswer(back);
  const out: string[] = [];
  for (const raw of norm.split(TOKEN_SPLIT)) {
    let t = raw.trim();
    if (!t) continue;
    t = t.replace(/旧称.*$/, ""); // 〔旧称XX〕括注（可能黏在 token 尾部），不参与判定
    if (!t) continue;
    if (t.length < 2 && !/[a-z0-9]/.test(t)) continue;
    if (STOP_TOKENS.has(t)) continue;
    if (t.length <= 8 && COUNT_RE.test(t)) continue;
    if (frontNorm.includes(t)) continue; // 题面已含的概念词（如「CMMI 五级」）
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * 口诀词定位匹配：标准答案里的口诀压缩串（如「初重定管优」「业数过应测」），
 * 用户展开列举（「初始 可重复 已定义 已管理 优化」）时，口诀各字按序在词序列中
 * 定位（每词消耗一次，字可在词中任意位置——「定」落在「已定义」）即算命中。
 * 仅当用户答案按分隔符切成 ≥3 个词且关键点为 3–8 字纯中文串时启用，防止巧合误判。
 */
function acronymHit(t: string, rawUser: string): boolean {
  const core = t.replace(/[^一-鿿]/g, "");
  if (core.length < 3 || core.length > 8) return false;
  const words = rawUser.split(SEP_RE).map((w) => w.trim()).filter(Boolean);
  if (words.length < 3) return false;
  let start = 0;
  for (const ch of core) {
    let found = -1;
    for (let j = start; j < words.length; j++) {
      if (words[j].includes(ch)) {
        found = j;
        break;
      }
    }
    if (found < 0) return false;
    start = found + 1;
  }
  return true;
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
  // 分隔符 + 弱符号都移除：用户答案用顿号/逗号/冒号等分隔时仍能命中关键点
  const stripAll = (s: string) => stripWeak(s.replace(SEP_RE, ""));
  const u2 = stripAll(u);

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
        .map(stripAll)
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
        hit = u2.includes(stripAll(t));
      }
      if (hit) seqHit = true;
    } else {
      hit = u2.includes(stripAll(t)) || acronymHit(t, user);
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
    score >= 0.65 ? "correct" : score >= 0.45 ? "partial" : "wrong";
  // 核心排序点命中但整体不足：保底 partial（细节可改判）
  if (verdict === "wrong" && seqHit) verdict = "partial";
  return { verdict, hits, total: tokens.length, hitTokens, missTokens };
}