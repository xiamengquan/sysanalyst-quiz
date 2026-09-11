import type { KbItem } from "@/lib/types";

export type KbSearchHeading = { level: number; text: string; slug: string };

export type KbSearchDoc = {
  id: string;
  title: string;
  sectionId: string;
  sectionTitle: string;
  kind?: string;
  chapter?: number | null;
  note?: string;
  status?: string;
  path?: string;
  headings: KbSearchHeading[];
  text: string;
};

export type KbSearchIndex = {
  meta?: { version?: string; builtAt?: string; docs?: number };
  docs: KbSearchDoc[];
};

export type KbHitKind = "title" | "heading" | "body";

export type KbSearchHit = {
  id: string;
  title: string;
  kind?: string;
  note?: string;
  status?: string;
  chapter?: number | null;
  sectionTitle: string;
  hitKind: KbHitKind;
  score: number;
  snippet: string;
  heading?: string;
  slug?: string;
};

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

function snippetAround(text: string, q: string, radius = 36): string {
  const lower = text.toLowerCase();
  const qi = lower.indexOf(q.toLowerCase());
  if (qi < 0) return text.slice(0, radius * 2) + (text.length > radius * 2 ? "…" : "");
  const start = Math.max(0, qi - radius);
  const end = Math.min(text.length, qi + q.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/** Catalog-only filter when search index is not yet loaded. */
export function filterCatalogItems(
  items: (KbItem & { sectionId: string; sectionTitle: string })[],
  query: string,
  kind: string,
  sectionId: string,
) {
  const q = query.trim().toLowerCase();
  const qn = norm(query);
  return items.filter((it) => {
    if (kind !== "all" && (it.kind || "") !== kind) return false;
    if (sectionId !== "all" && it.sectionId !== sectionId) return false;
    if (!q) return true;
    const bag = [it.title, it.note || "", it.id, String(it.chapter ?? ""), it.sectionTitle]
      .join(" ")
      .toLowerCase();
    if (bag.includes(q)) return true;
    if (qn && norm(bag).includes(qn)) return true;
    return false;
  });
}

export function searchKbDocs(
  docs: KbSearchDoc[],
  query: string,
  kind: string,
  sectionId: string,
  limit = 40,
): KbSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const ql = q.toLowerCase();
  const qn = norm(q);
  const hits: KbSearchHit[] = [];

  for (const doc of docs) {
    if (kind !== "all" && (doc.kind || "") !== kind) continue;
    if (sectionId !== "all" && doc.sectionId !== sectionId) continue;

    const titleBag = [doc.title, doc.note || "", doc.id, String(doc.chapter ?? "")].join(" ");
    if (titleBag.toLowerCase().includes(ql) || norm(titleBag).includes(qn)) {
      hits.push({
        id: doc.id,
        title: doc.title,
        kind: doc.kind,
        note: doc.note,
        status: doc.status,
        chapter: doc.chapter,
        sectionTitle: doc.sectionTitle,
        hitKind: "title",
        score: 100 + (doc.title.toLowerCase().includes(ql) ? 20 : 0),
        snippet: doc.note || doc.sectionTitle,
      });
    }

    for (const h of doc.headings || []) {
      if (h.text.toLowerCase().includes(ql) || norm(h.text).includes(qn)) {
        hits.push({
          id: doc.id,
          title: doc.title,
          kind: doc.kind,
          note: doc.note,
          status: doc.status,
          chapter: doc.chapter,
          sectionTitle: doc.sectionTitle,
          hitKind: "heading",
          score: 70,
          snippet: h.text,
          heading: h.text,
          slug: h.slug,
        });
      }
    }

    if (doc.text.toLowerCase().includes(ql) || norm(doc.text).includes(qn)) {
      // skip body hit if title already matched (avoid noise)
      const alreadyTitle = hits.some((x) => x.id === doc.id && x.hitKind === "title");
      if (!alreadyTitle) {
        hits.push({
          id: doc.id,
          title: doc.title,
          kind: doc.kind,
          note: doc.note,
          status: doc.status,
          chapter: doc.chapter,
          sectionTitle: doc.sectionTitle,
          hitKind: "body",
          score: 40,
          snippet: snippetAround(doc.text, q),
        });
      }
    }
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh"));
  // Deduplicate same id+heading
  const seen = new Set<string>();
  const out: KbSearchHit[] = [];
  for (const h of hits) {
    const key = `${h.id}|${h.hitKind}|${h.heading || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}
