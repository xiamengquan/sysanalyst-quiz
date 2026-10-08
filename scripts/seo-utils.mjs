import fs from "node:fs";
import path from "node:path";

export const KB_ROUTE_ALIASES = {
  "kp-13-1": "kp-运维指标-MTTR-MTBF-MTTF-MTTA",
};

const SECTION_ORDER = {
  "api-ref": 0,
  root: 1,
  part1: 2,
  part2: 3,
  part3: 4,
  quick: 5,
  essay: 6,
};

export function siteUrl(root) {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  const base = raw || "https://maintruly.top";
  return base.replace(/\/+$/, "");
}

export function absoluteUrl(root, pathname) {
  const base = siteUrl(root);
  let p = pathname.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  const segments = p.split("/").filter(Boolean);
  const encoded = segments.map((seg) => encodeURIComponent(decodeURIComponent(seg)));
  const pathPart = encoded.length ? `/${encoded.join("/")}/` : "/";
  return `${base}${pathPart}`;
}

export function parseKpNumericParts(id) {
  if (!id.startsWith("kp-")) return null;
  const body = id.slice(3);
  if (!/^\d/.test(body)) return null;
  const parts = body.split("-").map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  return parts;
}

export function compareKbRouteIds(a, b) {
  const na = parseKpNumericParts(a);
  const nb = parseKpNumericParts(b);
  if (na && nb) {
    const len = Math.max(na.length, nb.length);
    for (let i = 0; i < len; i++) {
      const da = na[i] ?? 0;
      const db = nb[i] ?? 0;
      if (da !== db) return da - db;
    }
    return 0;
  }
  if (na && !nb) return -1;
  if (!na && nb) return 1;
  return a.localeCompare(b, "zh-Hans-CN");
}

export function collectKbIndexEntries(index) {
  const out = [];
  (index.sections ?? []).forEach((sec, si) => {
    const sectionId = sec.id ?? `sec-${si}`;
    const sectionOrder = SECTION_ORDER[sectionId] ?? 50 + si;
    (sec.items ?? []).forEach((it, ii) => {
      if (!it.id || !it.path || it.path.endsWith("/")) return;
      out.push({
        id: it.id,
        path: it.path,
        chapter: it.chapter,
        kind: it.kind,
        sectionId,
        sectionOrder,
        itemOrder: ii,
      });
    });
  });
  return out;
}

export function sortKbEntriesForSitemap(entries) {
  return [...entries].sort((a, b) => {
    if (a.sectionId === "api-ref" && b.sectionId === "api-ref") {
      return compareKbRouteIds(a.id, b.id);
    }
    if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
    return a.itemOrder - b.itemOrder;
  });
}

function loadChapterHeat(root) {
  const heat = new Map();
  try {
    const rows = JSON.parse(
      fs.readFileSync(path.join(root, "public/data/questions.json"), "utf8"),
    );
    for (const row of rows) {
      const ch = row.ch;
      if (ch == null || ch === 0 || ch === 99 || row.bank === "real") continue;
      heat.set(ch, (heat.get(ch) ?? 0) + 1);
    }
  } catch {
    /* optional */
  }
  return heat;
}

function lastModifiedForPath(root, relPath) {
  for (const base of ["content/kb", "public/kb"]) {
    try {
      return fs.statSync(path.join(root, base, relPath)).mtime;
    } catch {
      /* next */
    }
  }
  return undefined;
}

function releaseLatestDate(root) {
  try {
    const notes = JSON.parse(
      fs.readFileSync(path.join(root, "public/data/release-notes.json"), "utf8"),
    );
    const d = notes.releases?.[0]?.date;
    if (!d) return undefined;
    const t = Date.parse(d);
    return Number.isNaN(t) ? undefined : new Date(t);
  } catch {
    return undefined;
  }
}

function metaFallbackDate(index) {
  const d = index.meta?.apiPolish || index.meta?.effective;
  if (!d) return undefined;
  const t = Date.parse(d);
  return Number.isNaN(t) ? undefined : new Date(t);
}

function priorityForEntry(entry, hotChapters) {
  const id = entry.id;
  if (id.startsWith("quick-")) return { priority: 0.75, changefreq: "weekly" };
  if (id.startsWith("ch") || entry.kind === "legacy") {
    return { priority: 0.55, changefreq: "monthly" };
  }
  if (entry.kind === "index" || id.endsWith("-index")) {
    return { priority: 0.72, changefreq: "monthly" };
  }
  const ch = entry.chapter;
  if (ch != null && hotChapters.has(ch)) {
    return { priority: 0.8, changefreq: "weekly" };
  }
  if (ch != null) return { priority: 0.7, changefreq: "monthly" };
  return { priority: 0.65, changefreq: "monthly" };
}

function fmtDate(d) {
  if (!d) return undefined;
  return d.toISOString();
}

function xmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildSitemapUrls(root) {
  const index = JSON.parse(
    fs.readFileSync(path.join(root, "public/data/kb-index.json"), "utf8"),
  );
  const heat = loadChapterHeat(root);
  const hotChapters = new Set(
    [...heat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([ch]) => ch),
  );
  const siteUpdated = releaseLatestDate(root) ?? metaFallbackDate(index);
  const fallback = metaFallbackDate(index);

  const staticRoutes = [
    { loc: absoluteUrl(root, "/"), lastmod: siteUpdated, changefreq: "weekly", priority: 1 },
    { loc: absoluteUrl(root, "/kb"), lastmod: siteUpdated, changefreq: "weekly", priority: 0.9 },
    { loc: absoluteUrl(root, "/case"), lastmod: siteUpdated, changefreq: "weekly", priority: 0.85 },
    { loc: absoluteUrl(root, "/about"), lastmod: siteUpdated, changefreq: "monthly", priority: 0.5 },
    {
      loc: absoluteUrl(root, "/changelog"),
      lastmod: siteUpdated,
      changefreq: "weekly",
      priority: 0.4,
    },
  ];

  let entries = collectKbIndexEntries(index);
  for (const [aliasId, targetId] of Object.entries(KB_ROUTE_ALIASES)) {
    const target = entries.find((e) => e.id === targetId);
    if (target) {
      entries.push({ ...target, id: aliasId, sectionId: "api-ref", sectionOrder: 0 });
    }
  }
  const sorted = sortKbEntriesForSitemap(entries);
  const seen = new Set();
  const kbRoutes = [];
  for (const entry of sorted) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    const { priority, changefreq } = priorityForEntry(entry, hotChapters);
    kbRoutes.push({
      loc: absoluteUrl(root, `/kb/${entry.id}`),
      lastmod: lastModifiedForPath(root, entry.path) ?? fallback,
      changefreq,
      priority,
    });
  }
  return [...staticRoutes, ...kbRoutes];
}

export function renderSitemapXml(urls) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const u of urls) {
    lines.push("<url>");
    lines.push(`<loc>${xmlEscape(u.loc)}</loc>`);
    if (u.lastmod) lines.push(`<lastmod>${fmtDate(u.lastmod)}</lastmod>`);
    if (u.changefreq) lines.push(`<changefreq>${u.changefreq}</changefreq>`);
    if (u.priority != null) lines.push(`<priority>${u.priority}</priority>`);
    lines.push("</url>");
  }
  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}

export function renderRobotsTxt(root) {
  const host = siteUrl(root);
  return `# Generated by scripts/generate-seo.mjs — do not edit by hand
User-agent: *
Allow: /
Disallow: /knowledge/
Disallow: /*?*

User-agent: Bingbot
Allow: /
Disallow: /knowledge/
Disallow: /*?*
Crawl-delay: 1

User-agent: Yandex
Allow: /
Disallow: /knowledge/
Disallow: /*?*
Crawl-delay: 1

Host: ${host}
Sitemap: ${host}/sitemap.xml
`;
}
