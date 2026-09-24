#!/usr/bin/env node
/** 非真题重编质量门禁 */
import fs from "node:fs";
import path from "node:path";
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
if (errors.length) {
  console.error("FAIL", errors);
  process.exit(1);
}
console.log("OK");
