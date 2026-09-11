#!/usr/bin/env node
/**
 * Build public/data/kb-search-index.json from kb-index + public/kb markdown.
 * Enables instant catalog + heading + body search without fetching all MD at runtime.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INDEX = path.join(ROOT, "public/data/kb-index.json");
const KB_DIR = path.join(ROOT, "public/kb");
const OUT = path.join(ROOT, "public/data/kb-search-index.json");

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "")
    .slice(0, 80);
}

function stripMd(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\|.*\|$/gm, " ")
    .replace(/^>\s?/gm, "")
    .replace(/[*_~#>|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadings(md) {
  const headings = [];
  const re = /^(#{1,3})\s+(.+?)\s*$/gm;
  let m;
  while ((m = re.exec(md))) {
    const text = m[2].replace(/[*_`]/g, "").trim();
    if (!text) continue;
    headings.push({ level: m[1].length, text, slug: slugify(text) });
  }
  return headings;
}

function main() {
  const catalog = JSON.parse(fs.readFileSync(INDEX, "utf8"));
  const docs = [];
  let missing = 0;

  for (const sec of catalog.sections || []) {
    for (const item of sec.items || []) {
      if (!item.path || String(item.path).endsWith("/")) continue;
      const fp = path.join(KB_DIR, item.path);
      if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
        missing += 1;
        continue;
      }
      const md = fs.readFileSync(fp, "utf8");
      const headings = extractHeadings(md);
      const text = stripMd(md);
      docs.push({
        id: item.id,
        title: item.title,
        sectionId: sec.id,
        sectionTitle: sec.title,
        kind: item.kind || "",
        chapter: item.chapter ?? null,
        note: item.note || "",
        status: item.status || "正式",
        path: item.path,
        headings,
        text,
      });
    }
  }

  const payload = {
    meta: {
      version: catalog.meta?.version || "v1.0",
      builtAt: new Date().toISOString().slice(0, 10),
      docs: docs.length,
      missing,
    },
    docs,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload), "utf8");
  console.log({ out: OUT, docs: docs.length, missing, bytes: fs.statSync(OUT).size });
}

main();
