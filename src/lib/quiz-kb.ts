import type { CaseItem, Question } from "@/lib/types";
import type { KbFlatItem } from "@/lib/kb-resolve";
import { searchKbDocs, type KbSearchDoc } from "@/lib/kb-search";

export type RelatedKb = {
  item: KbFlatItem;
  reason: string;
  score: number;
};

/** 选择题 / 案例简答共用的匹配输入 */
export type KbTopicRef = {
  ch: number;
  point?: string;
  stem?: string;
  learn_path?: string;
  /** 案例领域，如「需求工程」 */
  domain?: string;
  /** 案例题型，如「方案对比」 */
  case_type?: string;
  /** 额外检索词（子问提示等） */
  extraQueries?: string[];
  /** 是否案例简答场景（会抬高案例教程等） */
  isCase?: boolean;
};

const LEARN_PATH_QUICK: Record<string, string> = {
  req: "quick-req-learn",
  sao: "quick-sao-learn",
};

function byId(catalog: KbFlatItem[], id: string) {
  return catalog.find((c) => c.id === id) || null;
}

function searchBump(
  bump: (item: KbFlatItem | null | undefined, score: number, reason: string) => void,
  catalog: KbFlatItem[],
  searchDocs: KbSearchDoc[],
  query: string,
  reason: string,
  baseScore: number,
) {
  const q = query.trim();
  if (!q) return;
  if (searchDocs.length) {
    const hits = searchKbDocs(searchDocs, q, "all", "all", 10);
    for (const h of hits) {
      const item = byId(catalog, h.id);
      const bonus = h.hitKind === "title" ? 18 : h.hitKind === "heading" ? 12 : 6;
      bump(item, baseScore + Math.min(h.score, 20) + bonus, reason);
    }
    return;
  }
  for (const c of catalog) {
    const bag = `${c.title} ${c.note || ""}`;
    if (bag.includes(q)) bump(c, baseScore, reason);
  }
}

/** 按当前题目/案例匹配相关正式知识点（章节精炼优先，其次考点检索与速查） */
export function findRelatedKbForTopic(
  topic: KbTopicRef,
  catalog: KbFlatItem[],
  searchDocs: KbSearchDoc[] = [],
  limit = 6,
): RelatedKb[] {
  const scored = new Map<string, RelatedKb>();

  const bump = (item: KbFlatItem | null | undefined, score: number, reason: string) => {
    if (!item?.path || item.path.endsWith("/")) return;
    if (item.kind === "index" || item.kind === "entry") {
      // 入口/篇索引仅作兜底，压低权重（案例教程例外）
      if (item.id !== "case-tutorial") score = Math.min(score, 25);
    }
    const prev = scored.get(item.id);
    if (!prev || score > prev.score) {
      scored.set(item.id, { item, score, reason });
    }
  };

  // 1) 同章正式精炼
  if (topic.ch >= 1) {
    const chDoc = catalog.find((c) => c.kind === "chapter" && Number(c.chapter) === Number(topic.ch));
    bump(chDoc, 100, `第${topic.ch}章精炼`);
  }

  // 2) 学习路径速查卡
  if (topic.learn_path && LEARN_PATH_QUICK[topic.learn_path]) {
    bump(byId(catalog, LEARN_PATH_QUICK[topic.learn_path]), 78, "本题学习路径");
  }

  // 3) 考点名称
  const point = (topic.point || "").trim();
  if (point) {
    searchBump(bump, catalog, searchDocs, point, `考点「${point}」`, 55);
  }

  // 4) 案例：领域 / 题型 / 答题教程
  if (topic.isCase) {
    bump(byId(catalog, "case-tutorial"), 72, "案例答题方法");
    if (topic.domain) {
      searchBump(bump, catalog, searchDocs, topic.domain, `领域「${topic.domain}」`, 50);
    }
    if (topic.case_type) {
      searchBump(bump, catalog, searchDocs, topic.case_type, `题型「${topic.case_type}」`, 42);
    }
    // 需求域常见五法卡
    if ((topic.domain || "").includes("需求") || topic.ch === 11) {
      bump(byId(catalog, "quick-req-five"), 58, "需求获取五法");
      bump(byId(catalog, "quick-req-learn"), 50, "需求学习路径");
    }
  }

  // 5) 额外检索词（子问等）
  for (const raw of topic.extraQueries || []) {
    const kw = raw.replace(/[（）()。？?、，,\s]/g, "").slice(0, 16);
    if (kw.length >= 2) {
      searchBump(bump, catalog, searchDocs, kw, "子问相关", 38);
    }
  }

  // 6) 第 0 章 / 杂项：题干关键词
  if (topic.ch === 0 && searchDocs.length) {
    const kw = point || (topic.stem || "").replace(/[（）()。？?、，,\s]/g, "").slice(0, 12);
    if (kw.length >= 2) {
      searchBump(bump, catalog, searchDocs, kw, "题干相关", 40);
    }
  }

  // 7) 章节速查轻推
  if (topic.ch === 2) bump(byId(catalog, "quick-math-plain"), 45, "本章速查");
  if (topic.ch === 4) bump(byId(catalog, "quick-net-abbr"), 45, "本章速查");
  if (topic.ch === 9) bump(byId(catalog, "quick-auth-sec"), 42, "本章速查");
  if (topic.ch === 11) {
    bump(byId(catalog, "quick-req-five"), 48, "需求速查");
    bump(byId(catalog, "quick-compare"), 35, "高频对比");
  }
  if (topic.ch === 7) bump(byId(catalog, "quick-uml-learn"), 48, "UML 速查");
  if (topic.ch === 12 || topic.ch === 13) {
    bump(byId(catalog, "quick-compare"), 40, "高频对比");
  }

  return [...scored.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function findRelatedKbForQuestion(
  q: Question,
  catalog: KbFlatItem[],
  searchDocs: KbSearchDoc[] = [],
  limit = 6,
): RelatedKb[] {
  return findRelatedKbForTopic(
    {
      ch: q.ch,
      point: q.point,
      stem: q.stem,
      learn_path: q.learn_path,
    },
    catalog,
    searchDocs,
    limit,
  );
}

export function findRelatedKbForCase(
  c: CaseItem,
  catalog: KbFlatItem[],
  searchDocs: KbSearchDoc[] = [],
  limit = 6,
): RelatedKb[] {
  const extraQueries = (c.questions || [])
    .flatMap((qq) => [qq.prompt, qq.hint, ...(qq.rubric?.must_hit || [])])
    .filter(Boolean) as string[];

  return findRelatedKbForTopic(
    {
      ch: c.chapter,
      point: c.point,
      stem: c.stem,
      domain: c.domain,
      case_type: c.case_type,
      extraQueries: extraQueries.slice(0, 4),
      isCase: true,
    },
    catalog,
    searchDocs,
    limit,
  );
}
