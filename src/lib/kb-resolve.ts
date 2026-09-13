import type { KbItem } from "@/lib/types";

export type KbFlatItem = KbItem & { sectionTitle?: string };

/** 从 kb-index 展平条目 */
export function flattenKbIndex(sections: { title?: string; items?: KbItem[] }[]): KbFlatItem[] {
  return sections.flatMap((sec) =>
    (sec.items || [])
      .filter((it) => it.path && !it.path.endsWith("/"))
      .map((it) => ({ ...it, sectionTitle: sec.title })),
  );
}

function normPath(p: string) {
  return p
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^content\/kb\//, "")
    .replace(/^kb\//, "")
    .replace(/^\/+/, "");
}

function fileName(p: string) {
  const n = normPath(p);
  const i = n.lastIndexOf("/");
  return i >= 0 ? n.slice(i + 1) : n;
}

function stripMd(name: string) {
  return name.replace(/\.md$/i, "");
}

/** 是否像知识点路径引用（代码片段） */
export function looksLikeKbPath(text: string) {
  const t = text.trim();
  if (!t || t.length > 180) return false;
  if (/\s/.test(t)) return false;
  if (!/\.md$/i.test(t) && !/^速查\//.test(t) && !/^第\d+章/.test(t) && !/章-/.test(t)) {
    return /\.md$/i.test(t);
  }
  return true;
}

/**
 * 解析路径 / 书名 / id 到正式条目。
 * 优先级：精确 path → 文件名 → 标题包含 → id
 */
export function resolveKbRef(
  items: KbFlatItem[],
  raw: string,
  opts?: { excludeId?: string },
): KbFlatItem | null {
  const q = raw.trim().replace(/^《|》$/g, "");
  if (!q) return null;
  const exclude = opts?.excludeId;

  const byId = items.find((it) => it.id === q && it.id !== exclude);
  if (byId) return byId;

  const np = normPath(q);
  const exact = items.find((it) => it.id !== exclude && normPath(it.path || "") === np);
  if (exact) return exact;

  const fn = fileName(np);
  const byFile = items.filter(
    (it) => it.id !== exclude && fileName(it.path || "").toLowerCase() === fn.toLowerCase(),
  );
  if (byFile.length === 1) return byFile[0];
  if (byFile.length > 1) {
    const withDir = byFile.find((it) => normPath(it.path || "").endsWith(np));
    if (withDir) return withDir;
  }

  const stem = stripMd(fn);
  const byStem = items.filter((it) => {
    if (it.id === exclude) return false;
    const p = stripMd(fileName(it.path || ""));
    const title = it.title || "";
    return p === stem || title.includes(stem) || stem.includes(title.replace(/\s/g, ""));
  });
  if (byStem.length === 1) return byStem[0];

  const byTitle = items.filter((it) => {
    if (it.id === exclude) return false;
    const title = it.title || "";
    return title === q || title.includes(q) || q.includes(title);
  });
  if (byTitle.length === 1) return byTitle[0];
  // 书名常省略「速查 ·」前缀
  const loose = items.find((it) => {
    if (it.id === exclude) return false;
    const t = (it.title || "").replace(/^速查\s*[·•]\s*/, "");
    return t === q || t.includes(q) || q.includes(t);
  });
  return loose || null;
}

/** 从 /kb/{id}/ 或 /kb/{id}/#hash 抽出 id */
export function parseKbHref(href: string): { id: string; hash?: string } | null {
  const m = href.match(/^\/kb\/([^/#/?]+)\/?(?:#([^?]*))?/);
  if (!m) return null;
  return { id: decodeURIComponent(m[1]), hash: m[2] ? decodeURIComponent(m[2]) : undefined };
}
