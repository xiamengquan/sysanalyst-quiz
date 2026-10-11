import type { KbItem } from "@/lib/types";
import { resolveKbRouteAlias } from "@/lib/kb-route-aliases";

export type KbFlatItem = KbItem & { sectionTitle?: string };

/** 从 kb-index 展平条目 */
export function flattenKbIndex(sections: { title?: string; items?: KbItem[] }[]): KbFlatItem[] {
  return sections.flatMap((sec) =>
    (sec.items || [])
      .filter((it) => it.path && !it.path.endsWith("/"))
      .map((it) => ({ ...it, sectionTitle: sec.title })),
  );
}

export function normPath(p: string) {
  return p
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^content\/kb\//, "")
    .replace(/^kb\//, "")
    .replace(/^\/+/, "");
}

/**
 * 静态导出 / CDN 路由里，Next 可能把 [id] 写成 percent-encoding（如 kp-%E8%BD%AF…），
 * 而 kb-index 里是 Unicode 原文（kp-软件…）。查找前须对齐。
 */
export function normalizeKbRouteId(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  for (let i = 0; i < 3; i++) {
    if (!/%[0-9A-Fa-f]{2}/.test(s)) break;
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }
  return resolveKbRouteAlias(s);
}

export function findKbItemByRouteId(catalog: KbFlatItem[], routeId: string): KbFlatItem | null {
  const norm = normalizeKbRouteId(routeId);
  const tree = getKbRouteTree(catalog);
  return tree.byId.get(norm) ?? tree.byId.get(routeId) ?? null;
}

/** 相对当前正文文件路径，解析 Markdown 链接中的 ./ ../ 路径 */
export function resolveRelativeKbPath(baseItemPath: string, href: string): string {
  const baseDir = normPath(baseItemPath).split("/");
  if (baseDir.length) baseDir.pop();
  const segments = href.trim().replace(/\\/g, "/").split("/");
  for (const seg of segments) {
    if (seg === "..") baseDir.pop();
    else if (seg === "." || seg === "") continue;
    else baseDir.push(seg);
  }
  return baseDir.join("/");
}

/** 是否为应映射到 /kb/{id}/ 的 Markdown 文件链接（非外链、非已是站内路由） */
export function isKbMarkdownHref(href: string): boolean {
  const h = href.trim();
  if (!h || /^(https?:|mailto:|tel:|#)/i.test(h)) return false;
  if (h.startsWith("/kb/")) return false;
  if (/\.md$/i.test(h)) return true;
  return looksLikeKbPath(h);
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
 * KB 路由树：所有 id / 路径 / 文件名 / 标题的统一查找索引。
 * 任何 KB 引用解析（链接改写、codespan、书名号、路由 id）都应先查树。
 */
export interface KbRouteTree {
  items: KbFlatItem[];
  byId: Map<string, KbFlatItem>;
  byPath: Map<string, KbFlatItem[]>;
  byFile: Map<string, KbFlatItem[]>;
  byPathStem: Map<string, KbFlatItem[]>;
  byTitle: Map<string, KbFlatItem[]>;
}

export function buildKbRouteTree(items: KbFlatItem[]): KbRouteTree {
  const tree: KbRouteTree = {
    items,
    byId: new Map(),
    byPath: new Map(),
    byFile: new Map(),
    byPathStem: new Map(),
    byTitle: new Map(),
  };
  for (const it of items) {
    if (it.id && !tree.byId.has(it.id)) tree.byId.set(it.id, it);
    const p = normPath(it.path || "");
    if (p) pushMap(tree.byPath, p, it);
    const fn = fileName(p).toLowerCase();
    if (fn) pushMap(tree.byFile, fn, it);
    const stem = stripMd(fileName(p));
    if (stem) pushMap(tree.byPathStem, stem, it);
    const title = (it.title || "").trim();
    if (title) pushMap(tree.byTitle, title, it);
  }
  return tree;
}

function pushMap<K>(map: Map<K, KbFlatItem[]>, key: K, it: KbFlatItem) {
  const arr = map.get(key);
  if (arr) arr.push(it);
  else map.set(key, [it]);
}

/** 同一 items 数组引用只建一次树（flatten 产物在客户端/构建端均为稳定引用） */
const routeTreeCache = new WeakMap<KbFlatItem[], KbRouteTree>();

export function getKbRouteTree(items: KbFlatItem[]): KbRouteTree {
  let tree = routeTreeCache.get(items);
  if (!tree) {
    tree = buildKbRouteTree(items);
    routeTreeCache.set(items, tree);
  }
  return tree;
}

/** 引用查询串规范化：剥书名号壳 + 递归 percent-decode（marked 会把 href 编码） */
function decodeKbRefQuery(raw: string): string {
  let s = raw.trim().replace(/^《|》$/g, "").trim();
  for (let i = 0; i < 3; i++) {
    if (!/%[0-9A-Fa-f]{2}/.test(s)) break;
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }
  return s;
}

function filterEx(list: KbFlatItem[], exclude?: string) {
  return exclude ? list.filter((it) => it.id !== exclude) : list;
}

/**
 * 解析路径 / 书名 / id 到正式条目（统一走路由树）。
 * 优先级：id → 精确 path → 文件名 → 标题包含
 */
export function resolveKbRef(
  items: KbFlatItem[],
  raw: string,
  opts?: { excludeId?: string },
): KbFlatItem | null {
  const q = decodeKbRefQuery(raw);
  if (!q) return null;
  const exclude = opts?.excludeId;
  const tree = getKbRouteTree(items);

  const byId = filterEx([tree.byId.get(q)].filter(Boolean) as KbFlatItem[], exclude)[0];
  if (byId) return byId;

  const np = normPath(q);
  const exact = filterEx(tree.byPath.get(np) ?? [], exclude);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return exact.find((it) => normPath(it.path || "") === np) ?? exact[0];

  const fn = fileName(np);
  const byFile = filterEx(tree.byFile.get(fn.toLowerCase()) ?? [], exclude);
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
  // 精确同名标题优先：避免「软件产品线」被「5.6 软件产品线」等包含关系抢先命中
  const exactTitle = byTitle.find((it) => (it.title || "") === q);
  if (exactTitle) return exactTitle;
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
