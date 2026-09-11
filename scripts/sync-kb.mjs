#!/usr/bin/env node
/**
 * Sync content/kb → public/kb, copy kb-index, rebuild search index.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "content/kb");
const INDEX_SRC = path.join(ROOT, "content/kb-index.json");
const OUT_KB = path.join(ROOT, "public/kb");
const OUT_DATA = path.join(ROOT, "public/data");

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    if (ent.name.endsWith(".合并备份.md")) continue;
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function main() {
  if (!fs.existsSync(SRC)) throw new Error(`missing ${SRC}`);
  if (!fs.existsSync(INDEX_SRC)) throw new Error(`missing ${INDEX_SRC}`);

  rmrf(OUT_KB);
  copyDir(SRC, OUT_KB);
  fs.mkdirSync(OUT_DATA, { recursive: true });
  fs.copyFileSync(INDEX_SRC, path.join(OUT_DATA, "kb-index.json"));

  const r = spawnSync(process.execPath, [path.join(__dirname, "build-kb-search.mjs")], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status || 1);

  const n = countMd(OUT_KB);
  console.log({ syncedKb: n, index: "public/data/kb-index.json" });
}

function countMd(dir) {
  let n = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) n += countMd(p);
    else if (ent.name.endsWith(".md")) n += 1;
  }
  return n;
}

main();
