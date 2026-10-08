#!/usr/bin/env node
/**
 * sitemap 门禁：kb 索引完整、buildSitemapUrls 预期；--strict-out 校验 out/sitemap.xml。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  KB_ROUTE_ALIASES,
  buildSitemapUrls,
  compareKbRouteIds,
} from "./seo-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function kbIdFromLoc(u) {
  const m = u.match(/\/kb\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function locsFromXml(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const index = JSON.parse(fs.readFileSync(path.join(root, "public/data/kb-index.json"), "utf8"));
const ids = new Set();

for (const sec of index.sections ?? []) {
  for (const it of sec.items ?? []) {
    if (!it.id || !it.path || it.path.endsWith("/")) continue;
    ids.add(it.id);
    const fp = path.join(root, "content/kb", it.path);
    if (!fs.existsSync(fp)) {
      errors.push(`missing file for ${it.id}: content/kb/${it.path}`);
    }
  }
}

for (const [alias, target] of Object.entries(KB_ROUTE_ALIASES)) {
  if (!ids.has(target)) {
    errors.push(`alias ${alias} → ${target} but target not in kb-index`);
  }
}

const urlsJson = path.join(root, "public/data/sitemap-urls.json");
if (!fs.existsSync(urlsJson)) {
  errors.push("public/data/sitemap-urls.json 缺失（先 npm run generate:seo）");
}

const expected = buildSitemapUrls(root);
const expectedLocs = expected.map((u) => u.loc);

if (fs.existsSync(urlsJson)) {
  const stored = JSON.parse(fs.readFileSync(urlsJson, "utf8"));
  if (stored.urls?.length !== expectedLocs.length) {
    errors.push(
      `sitemap-urls.json 条数 ${stored.urls?.length ?? 0} ≠ 预期 ${expectedLocs.length}（请 npm run generate:seo）`,
    );
  }
}

const apiRefIds = new Set(
  (index.sections?.find((s) => s.id === "api-ref")?.items ?? []).map((i) => i.id),
);
const apiExpected = expectedLocs.filter((u) => {
  const id = kbIdFromLoc(u);
  return id && apiRefIds.has(id);
});
for (let i = 1; i < apiExpected.length; i++) {
  const a = kbIdFromLoc(apiExpected[i - 1]);
  const b = kbIdFromLoc(apiExpected[i]);
  if (compareKbRouteIds(a, b) > 0) {
    errors.push(`sitemap api-ref 排序错误：${a} 应在 ${b} 之后`);
    break;
  }
}

for (const [alias, target] of Object.entries(KB_ROUTE_ALIASES)) {
  if (expectedLocs.some((u) => kbIdFromLoc(u) === alias)) {
    errors.push(`sitemap 不应收录别名 URL：${alias}（canonical：${target}）`);
  }
}

const strictOut = process.argv.includes("--strict-out");
const outSm = path.join(root, "out/sitemap.xml");

if (strictOut) {
  if (!fs.existsSync(outSm)) {
    errors.push("out/sitemap.xml 不存在（先 npm run build）");
  } else {
    const locs = locsFromXml(fs.readFileSync(outSm, "utf8"));
    if (locs.length !== expectedLocs.length) {
      errors.push(`out/sitemap.xml url 数 ${locs.length} ≠ 预期 ${expectedLocs.length}`);
    }
    const expSet = new Set(expectedLocs);
    const outSet = new Set(locs);
    for (const u of expectedLocs) {
      if (!outSet.has(u)) errors.push(`out/sitemap 缺少 ${u}`);
    }
    for (const u of locs) {
      if (!expSet.has(u)) errors.push(`out/sitemap 多余 ${u}`);
    }
    for (const [alias] of Object.entries(KB_ROUTE_ALIASES)) {
      if (locs.some((u) => kbIdFromLoc(u) === alias)) {
        errors.push(`out/sitemap 含别名 ${alias}`);
      }
    }
  }
}

if (errors.length) {
  console.error("check-sitemap failed:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(
  `check-sitemap ok · expected ${expectedLocs.length} urls · kb ${ids.size} · aliases ${Object.keys(KB_ROUTE_ALIASES).length}${strictOut ? " · out verified" : ""}`,
);
