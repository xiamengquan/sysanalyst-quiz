#!/usr/bin/env node
/**
 * 工单 14：中文 kp id → 英文 canonical slug，旧 id 写入路由别名表。
 * 用法：node scripts/migrate-kb-slugs.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const mapPath = path.join(root, "src/lib/kb-slug-canonical-map.json");
const slugMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

function replaceInFile(fp, pairs) {
  let t = fs.readFileSync(fp, "utf8");
  let changed = false;
  for (const [oldId, newId] of pairs) {
    const encOld = encodeURIComponent(oldId);
    const patterns = [
      [`/kb/${oldId}`, `/kb/${newId}`],
      [`/kb/${oldId}/`, `/kb/${newId}/`],
      [`/kb/${encOld}`, `/kb/${newId}`],
      [`/kb/${encOld}/`, `/kb/${newId}/`],
      [`"${oldId}"`, `"${newId}"`],
      [`'${oldId}'`, `'${newId}'`],
      [`points/${oldId}.md`, `points/${newId}.md`],
    ];
    for (const [from, to] of patterns) {
      if (t.includes(from)) {
        t = t.split(from).join(to);
        changed = true;
      }
    }
  }
  if (changed && !dryRun) fs.writeFileSync(fp, t, "utf8");
  return changed;
}

const pairs = Object.entries(slugMap);

// 1. Rename point files
for (const [oldId, newId] of pairs) {
  for (const base of ["content/kb/points", "public/kb/points"]) {
    const oldFp = path.join(root, base, `${oldId}.md`);
    const newFp = path.join(root, base, `${newId}.md`);
    if (fs.existsSync(oldFp)) {
      if (dryRun) console.log("rename", oldFp, "->", newFp);
      else {
        fs.mkdirSync(path.dirname(newFp), { recursive: true });
        fs.renameSync(oldFp, newFp);
      }
    }
  }
}

// 2. Update kb-index (content + public data copy path is sync - only content)
for (const rel of ["content/kb-index.json"]) {
  const fp = path.join(root, rel);
  let data = JSON.parse(fs.readFileSync(fp, "utf8"));
  for (const sec of data.sections ?? []) {
    for (const it of sec.items ?? []) {
      if (slugMap[it.id]) {
        const newId = slugMap[it.id];
        it.id = newId;
        if (it.path?.startsWith("points/")) {
          it.path = `points/${newId}.md`;
        }
      }
    }
  }
  if (!dryRun) fs.writeFileSync(fp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

// 3. Global text replace
const dirs = [
  path.join(root, "content/kb"),
  path.join(root, "public/kb"),
  path.join(root, "src"),
  path.join(root, "scripts/python"),
  path.join(root, "docs"),
];
let n = 0;
for (const dir of dirs) {
  walk(dir, (fp) => {
    if (!/\.(md|json|py|tsx?|mjs)$/.test(fp)) return;
    if (fp.includes("kb-slug-canonical-map.json")) return;
    if (fp.includes("migrate-kb-slugs.mjs")) return;
    if (replaceInFile(fp, pairs)) n++;
  });
}

// 4. Fix index paths explicitly (already done in step 2)

console.log({ dryRun, slugCount: pairs.length, filesTouched: n });
