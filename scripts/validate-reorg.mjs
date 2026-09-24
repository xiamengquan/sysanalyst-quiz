#!/usr/bin/env node
/** 非真题重编质量门禁 + 机审 730/730 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pr = fs
  .readFileSync(path.join(root, "content/banks/practice/all.jsonl"), "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const n = pr.length;
const shortTrack = pr.filter((q) => q.style_track === "short").length;
const shortExp = pr.filter((q) => String(q.explain || q.exp || "").length < 35).length;
const template = pr.filter((q) => /下列说法正确的是/.test(q.stem)).length;
const st = {};
for (const q of pr) st[q.style_track] = (st[q.style_track] || 0) + 1;

const errors = [];
if (shortExp) errors.push(`short explain: ${shortExp}`);
if (template) errors.push(`template stem: ${template}`);
if (shortTrack < Math.ceil(n * 0.2)) errors.push(`short track ${shortTrack} < 20%`);

console.log({ n, styleTrack: st, shortTrackPct: ((100 * shortTrack) / n).toFixed(1), shortExp, template });
const audit = spawnSync("python3", ["scripts/python/audit_practice.py"], {
  cwd: root,
  encoding: "utf8",
});
const summaryPath = path.join(root, "content/workshop/review/自编全量机审摘要-20260910.json");
if (audit.status !== 0) {
  errors.push("audit_practice.py 执行失败");
} else if (!fs.existsSync(summaryPath)) {
  errors.push("缺少机审摘要文件");
} else {
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  if (summary.reject > 0) errors.push(`机审驳回 ${summary.reject}/${summary.total}`);
  else console.log("audit", `${summary.pass}/${summary.total}`);
}

if (errors.length) {
  console.error("FAIL", errors);
  process.exit(1);
}
console.log("OK");
