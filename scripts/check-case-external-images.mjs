#!/usr/bin/env node
/** 扫描案例 Markdown 中的外链图片/http 引用（供 CI 预警） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirs = [
  path.join(root, "content/banks/cases"),
  path.join(root, "content/banks/real/案例分析"),
];
const urlRe = /https?:\/\/[^\s)\]"']+/gi;
const hits = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".md")) {
      const t = fs.readFileSync(p, "utf8");
      const urls = t.match(urlRe);
      if (urls?.length) {
        hits.push({ file: path.relative(root, p), count: urls.length, sample: urls[0].slice(0, 80) });
      }
    }
  }
}
dirs.forEach(walk);

if (!hits.length) {
  console.log("check-case-external-images ok (no http(s) in case md)");
} else {
  console.warn(`check-case-external-images: ${hits.length} file(s) with external URLs`);
  hits.slice(0, 10).forEach((h) => console.warn(`  ${h.file}: ${h.count} e.g. ${h.sample}`));
}
