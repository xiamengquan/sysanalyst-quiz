#!/usr/bin/env node
/** 工坊 *-passed.jsonl 轻量机审（explain/模板/坏干扰） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEW = path.join(root, "content/workshop/new");
const BAD = /与.+无关|以上说法均不正确|与该概念无关/;
const TEMPLATE = /下列说法正确的是/;

const names = fs.readdirSync(NEW).filter((n) => n.endsWith("-passed.jsonl"));
const errors = [];
let n = 0;
for (const name of names) {
  const rows = fs
    .readFileSync(path.join(NEW, name), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  for (const q of rows) {
    n += 1;
    const exp = String(q.explain || q.exp || "");
    if (exp.length < 35) errors.push(`${q.id}: explain<35`);
    if (TEMPLATE.test(q.stem || "")) errors.push(`${q.id}: template stem`);
    for (const [k, v] of Object.entries(q.options || q.opts || {})) {
      if (BAD.test(String(v))) errors.push(`${q.id}: bad opt ${k}`);
    }
  }
}
console.log({ passedFiles: names.length, questions: n, errors: errors.length });
if (errors.length) {
  console.error(errors.slice(0, 20));
  process.exit(1);
}
console.log("OK");
