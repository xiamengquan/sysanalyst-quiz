#!/usr/bin/env node
/** API 考点页最小质量门禁：六节齐全、无旧版占位定义。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = JSON.parse(fs.readFileSync(path.join(root, "content/kb-index.json"), "utf8"));
const sections = ["概述", "定义", "要点", "易混辨析", "应试", "相关考点"];
const badPhrases = ["本节要点中含可誊写句", "核心表述见下方要点", "待编制", "- ****："];
const skip = new Set(["kp-2-7"]);
let errors = [];

for (const sec of index.sections || []) {
  if (sec.id !== "api-ref") continue;
  for (const it of sec.items || []) {
    if (skip.has(it.id)) continue;
    const fp = path.join(root, "content/kb", it.path);
    if (!fs.existsSync(fp)) {
      errors.push(`missing ${it.path}`);
      continue;
    }
    const t = fs.readFileSync(fp, "utf8");
    for (const s of sections) {
      if (!t.includes(`## ${s}`)) errors.push(`${it.id}: no ## ${s}`);
    }
    for (const p of badPhrases) {
      if (t.includes(p)) errors.push(`${it.id}: contains «${p}»`);
    }
    const dm = t.match(/## 定义\n\n([\s\S]*?)\n\n## 要点/);
    if (dm) {
      const def = dm[1].trim();
      if (def.length < 45) errors.push(`${it.id}: definition too short (${def.length})`);
    }
    const pm = t.match(/## 要点\n\n([\s\S]*?)\n\n## 易混/);
    if (pm) {
      const pts = pm[1].trim();
      if (pts.length < 80) errors.push(`${it.id}: 要点 too short (${pts.length})`);
    }
    const em = t.match(/## 应试\n\n([\s\S]*?)\n\n## 相关考点/);
    if (em) {
      const ex = em[1].trim();
      if (ex.length < 60) errors.push(`${it.id}: 应试 too short (${ex.length})`);
    }
  }
}

if (errors.length) {
  console.error("check-kb-points failed:\n" + errors.slice(0, 20).join("\n"));
  process.exit(1);
}
console.log("check-kb-points ok");
