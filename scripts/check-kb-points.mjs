#!/usr/bin/env node
/** API 考点页最小质量门禁：六节齐全、无旧版占位定义。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = JSON.parse(fs.readFileSync(path.join(root, "content/kb-index.json"), "utf8"));
const sections = [
  "概述",
  "速懂",
  "定义",
  "步骤与流程",
  "要点",
  "易混辨析",
  "应试",
  "相关考点",
];
const badPhrases = ["本节要点中含可誊写句", "核心表述见下方要点", "待编制", "- ****："];
const skip = new Set([]);
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
    const qm = t.match(/## 速懂\n\n([\s\S]*?)\n\n## 定义/);
    if (qm) {
      const q = qm[1].trim();
      if (q.length < 120) errors.push(`${it.id}: 速懂 too short (${q.length})`);
      if (!q.includes("一句话") || !q.includes("考什么")) {
        errors.push(`${it.id}: 速懂须含「一句话」「考什么」`);
      }
    }
    const sm = t.match(/## 步骤与流程\n\n([\s\S]*?)\n\n## 要点/);
    if (sm) {
      const st = sm[1].trim();
      if (st.length < 55) errors.push(`${it.id}: 步骤与流程 too short (${st.length})`);
    }
    const dm = t.match(/## 定义\n\n([\s\S]*?)\n\n## 步骤与流程/);
    if (dm) {
      const def = dm[1].trim();
      if (def.length < 80) errors.push(`${it.id}: definition too short (${def.length})`);
      const hasWhat =
        /(\*\*[^*]+\*\*[：:][^。\n]{0,96}是|（答卷·定义）[：:][^。\n]{0,96}是|是指|指的是|定义为|是一种|是一类|是一套)/.test(
          def,
        );
      const hasRole = /(作用|用于|主要用于)/.test(def);
      if (def.length > 0 && (!hasWhat || !hasRole)) {
        errors.push(`${it.id}: 定义须同时交代「是什么/指什么」与「作用/用于」`);
      }
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
