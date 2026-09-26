#!/usr/bin/env node
/** kb_def_overrides.json 与 api-ref 考点 id、正文文件对齐。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const overridesPath = path.join(root, "scripts/python/kb_def_overrides.json");
const indexPath = path.join(root, "content/kb-index.json");
const skip = new Set(["kp-2-7"]);
const errors = [];
const warns = [];

if (!fs.existsSync(overridesPath)) {
  console.error("check-kb-def-overrides: missing kb_def_overrides.json");
  process.exit(1);
}

const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const pointIds = new Set();
for (const sec of index.sections || []) {
  if (sec.id !== "api-ref") continue;
  for (const it of sec.items || []) {
    if (it.kind === "point") pointIds.add(it.id);
  }
}

for (const [id, text] of Object.entries(overrides)) {
  if (!id.startsWith("kp-")) warns.push(`override id 非 kp- 前缀：${id}`);
  if (!pointIds.has(id)) errors.push(`override 无对应 api-ref 考点：${id}`);
  const fp = path.join(root, "content/kb/points", `${id}.md`);
  if (!fs.existsSync(fp)) errors.push(`override 考点文件缺失：${id}.md`);
  const body = String(text || "").trim();
  if (body.length < 45) errors.push(`${id}: override 定义过短 (${body.length})`);
}

const covered = new Set(Object.keys(overrides));
const missingOverride = [...pointIds].filter((id) => !skip.has(id) && !covered.has(id));
if (missingOverride.length) {
  warns.push(
    `无 DEF override 的考点 ${missingOverride.length} 篇（由精修推断/章内收割补全，非错误）`,
  );
}

if (errors.length) {
  console.error("check-kb-def-overrides failed:\n" + errors.join("\n"));
  process.exit(1);
}
if (warns.length) {
  console.warn("check-kb-def-overrides warns:\n" + warns.slice(0, 8).join("\n"));
}
console.log(`check-kb-def-overrides ok (${Object.keys(overrides).length} overrides)`);
