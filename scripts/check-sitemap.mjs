#!/usr/bin/env node
/**
 * sitemap 门禁：索引文件存在、public/sitemap.xml 排序与条目完整。
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

const smPath = path.join(root, "public/sitemap.xml");
if (!fs.existsSync(smPath)) {
  const gen = spawnSync("node", ["scripts/generate-seo.mjs"], { cwd: root, encoding: "utf8" });
  if (gen.status !== 0) {
    errors.push("public/sitemap.xml 缺失且 generate-seo 失败");
  }
}

if (fs.existsSync(smPath)) {
  const xml = fs.readFileSync(smPath, "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = buildSitemapUrls(root);
  if (locs.length !== expected.length) {
    errors.push(`sitemap url 数 ${locs.length} ≠ 预期 ${expected.length}（请 npm run generate:seo）`);
  }
  const apiRefIds = new Set(
    (index.sections?.find((s) => s.id === "api-ref")?.items ?? []).map((i) => i.id),
  );
  for (const a of Object.keys(KB_ROUTE_ALIASES)) apiRefIds.add(a);
  const apiLocs = locs.filter((u) => {
    const id = kbIdFromLoc(u);
    return id && apiRefIds.has(id);
  });
  for (let i = 1; i < apiLocs.length; i++) {
    const a = kbIdFromLoc(apiLocs[i - 1]);
    const b = kbIdFromLoc(apiLocs[i]);
    if (compareKbRouteIds(a, b) > 0) {
      errors.push(`sitemap api-ref 排序错误：${a} 应在 ${b} 之后`);
      break;
    }
  }
  if (!locs.some((u) => kbIdFromLoc(u) === "kp-13-1")) {
    errors.push("sitemap 缺少 kp-13-1 别名 URL");
  }
}

const strictOut = process.argv.includes("--strict-out");
if (strictOut) {
  const outSm = path.join(root, "out/sitemap.xml");
  if (!fs.existsSync(outSm)) {
    errors.push("out/sitemap.xml 不存在（先 npm run build）");
  } else if (fs.existsSync(smPath)) {
    const a = fs.readFileSync(smPath, "utf8");
    const b = fs.readFileSync(outSm, "utf8");
    if (a !== b) errors.push("out/sitemap.xml 与 public/sitemap.xml 不一致");
  }
}

if (errors.length) {
  console.error("check-sitemap failed:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(
  `check-sitemap ok · kb entries ${ids.size} · aliases ${Object.keys(KB_ROUTE_ALIASES).length}`,
);
