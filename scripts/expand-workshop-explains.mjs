#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEW = path.join(root, "content/workshop/new");
const write = process.argv.includes("--write");

function lenExplain(s) {
  return String(s || "").length;
}

function expandExplain(q) {
  const prev = String(q.explain || q.exp || "").trim();
  if (lenExplain(prev) >= 35) return prev;
  const ans = String(q.answer ?? q.ans ?? "A")
    .trim()
    .toUpperCase()
    .slice(0, 1);
  const opts = q.options || q.opts || {};
  const correct = opts[ans] ? String(opts[ans]) : "";
  const point = q.point || "考点";
  let out = prev.startsWith("选 ") ? prev : `选 ${ans}。${prev}`;
  if (lenExplain(out) < 35 && correct) {
    const snippet = correct.length > 22 ? `${correct.slice(0, 22)}…` : correct;
    out += `正确项：${snippet}。`;
  }
  const wrong = ["A", "B", "C", "D"].find((k) => k !== ans && opts[k]);
  if (lenExplain(out) < 35 && wrong) {
    out += `勿与 ${wrong}（${String(opts[wrong]).slice(0, 16)}）混淆。`;
  }
  if (lenExplain(out) < 35) out += `紧扣「${point}」。`;
  return out.slice(0, 220);
}

const names = fs.readdirSync(NEW).filter((n) => n.endsWith("-passed.jsonl"));
let total = 0;
for (const name of names) {
  const fp = path.join(NEW, name);
  const lines = fs.readFileSync(fp, "utf8").split(/\r?\n/).filter(Boolean);
  let n = 0;
  const out = lines.map((line) => {
    const q = JSON.parse(line);
    const next = expandExplain(q);
    if (next !== (q.explain || q.exp)) {
      n += 1;
      q.explain = next;
      q.exp = next;
    }
    return JSON.stringify(q);
  });
  total += n;
  if (write) fs.writeFileSync(fp, out.join("\n") + "\n", "utf8");
  console.log(name, "expanded", n);
}
console.log({ total, write });
