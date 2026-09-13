import type { Question } from "@/lib/types";
import type { KbFlatItem } from "@/lib/kb-resolve";
import { searchKbDocs, type KbSearchDoc } from "@/lib/kb-search";

export type RelatedKb = {
  item: KbFlatItem;
  reason: string;
  score: number;
};

const LEARN_PATH_QUICK: Record<string, string> = {
  req: "quick-req-learn",
  sao: "quick-sao-learn",
};

function byId(catalog: KbFlatItem[], id: string) {
  return catalog.find((c) => c.id === id) || null;
}

/** 按当前题目匹配相关正式知识点（章节精炼优先，其次考点检索与学习路径速查） */
export function findRelatedKbForQuestion(
  q: Question,
  catalog: KbFlatItem[],
  searchDocs: KbSearchDoc[] = [],
  limit = 6,
): RelatedKb[] {
  const scored = new Map<string, RelatedKb>();

  const bump = (item: KbFlatItem | null | undefined, score: number, reason: string) => {
    if (!item?.path || item.path.endsWith("/")) return;
    if (item.kind === "index" || item.kind === "entry") {
      // 入口/篇索引仅作兜底，压低权重
      score = Math.min(score, 25);
    }
    const prev = scored.get(item.id);
    if (!prev || score > prev.score) {
      scored.set(item.id, { item, score, reason });
    } else if (prev && reason && !prev.reason.includes(reason)) {
      // keep higher score; ignore
    }
  };

  // 1) 同章正式精炼
  if (q.ch >= 1) {
    const chDoc = catalog.find((c) => c.kind === "chapter" && Number(c.chapter) === Number(q.ch));
    bump(chDoc, 100, `第${q.ch}章精炼`);
  }

  // 2) 学习路径速查卡
  if (q.learn_path && LEARN_PATH_QUICK[q.learn_path]) {
    bump(byId(catalog, LEARN_PATH_QUICK[q.learn_path]), 78, "本题学习路径");
  }

  // 3) 考点名称 → 检索索引 / 目录标题
  const point = (q.point || "").trim();
  if (point) {
    if (searchDocs.length) {
      const hits = searchKbDocs(searchDocs, point, "all", "all", 10);
      for (const h of hits) {
        const item = byId(catalog, h.id);
        const bonus = h.hitKind === "title" ? 18 : h.hitKind === "heading" ? 12 : 6;
        bump(item, 55 + Math.min(h.score, 20) + bonus, `考点「${point}」`);
      }
    } else {
      for (const c of catalog) {
        const bag = `${c.title} ${c.note || ""}`;
        if (bag.includes(point)) bump(c, 52, `考点「${point}」`);
      }
    }
  }

  // 4) 第 0 章 / 杂项：再以题干关键词轻量补检索
  if (q.ch === 0 && searchDocs.length) {
    const kw = point || (q.stem || "").replace(/[（）()。？?、，,\s]/g, "").slice(0, 12);
    if (kw.length >= 2) {
      for (const h of searchKbDocs(searchDocs, kw, "all", "all", 5)) {
        bump(byId(catalog, h.id), 40 + Math.min(h.score, 15), "题干相关");
      }
    }
  }

  // 5) 数学/网络弱项速查（按章节轻推）
  if (q.ch === 2) bump(byId(catalog, "quick-math-plain"), 45, "本章速查");
  if (q.ch === 4) bump(byId(catalog, "quick-net-abbr"), 45, "本章速查");
  if (q.ch === 9) bump(byId(catalog, "quick-auth-sec"), 42, "本章速查");
  if (q.ch === 11) {
    bump(byId(catalog, "quick-req-five"), 48, "需求速查");
    bump(byId(catalog, "quick-compare"), 35, "高频对比");
  }
  if (q.ch === 7) bump(byId(catalog, "quick-uml-learn"), 48, "UML 速查");

  return [...scored.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
