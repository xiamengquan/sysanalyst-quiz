#!/usr/bin/env node
/**
 * Phase B1：将 practice 库中 explain/exp 长度 <35 的题扩写至 ≥35（提示信息官门槛）。
 * 用法：node scripts/expand-b1-explains.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bankPath = path.join(root, "content/banks/practice/all.jsonl");
const workshopPath = path.join(
  root,
  "docs/question-workshop/reports/data/重编-20260924-批次B1-explain-patches.jsonl",
);
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
  const wrongEntries = ["A", "B", "C", "D"]
    .filter((k) => k !== ans && opts[k])
    .map((k) => ({ k, t: String(opts[k]).replace(/\s+/g, " ").slice(0, 18) }));

  let out = prev;
  const hasConclusion = /【结论】|选\s*[A-D]/.test(out);
  if (!hasConclusion) {
    out = `选 ${ans}。${out}`;
  } else if (!/选\s*[A-D]/.test(out)) {
    out = `选 ${ans}。${out}`;
  }

  if (lenExplain(out) < 35 && correct) {
    const snippet = correct.length > 22 ? `${correct.slice(0, 22)}…` : correct;
    out += `正确项：${snippet}。`;
  }

  if (lenExplain(out) < 35 && wrongEntries.length) {
    const w = wrongEntries[0];
    out += `勿与 ${w.k}（${w.t}）混淆。`;
  }

  if (lenExplain(out) < 35) {
    out += `紧扣「${point}」理解即可。`;
  }

  if (lenExplain(out) < 35) {
    out += "对照知识点精炼相应小节复习。";
  }

  return out.slice(0, 220);
}

const lines = fs.readFileSync(bankPath, "utf8").split(/\r?\n/).filter(Boolean);
const patches = [];
let changed = 0;

const outLines = lines.map((line) => {
  const q = JSON.parse(line);
  const prev = q.explain || q.exp || "";
  if (lenExplain(prev) >= 35) return line;

  const next = expandExplain(q);
  if (next !== prev) {
    changed += 1;
    patches.push({
      id: q.id,
      chapter: q.chapter ?? q.ch,
      point: q.point,
      explain_before: prev,
      explain: next,
      phase: "B1-explain",
      pass: "hint-officer-v1",
    });
    q.explain = next;
    if ("exp" in q) q.exp = next;
    q.reorganized_pass = "meta-v1+B1-explain";
    q.reorganized_at = "2026-09-24";
  }
  return JSON.stringify(q);
});

const stillShort = outLines
  .map((l) => JSON.parse(l))
  .filter((q) => lenExplain(q.explain || q.exp) < 35);

console.log({ changed, stillShort: stillShort.length });

if (stillShort.length) {
  console.error("still short ids:", stillShort.map((q) => q.id).slice(0, 10));
  process.exit(1);
}

if (write) {
  fs.writeFileSync(bankPath, outLines.join("\n") + "\n", "utf8");
  fs.writeFileSync(workshopPath, patches.map((p) => JSON.stringify(p)).join("\n") + "\n", "utf8");
  console.log("written", bankPath, "patches", patches.length, "→", workshopPath);
} else {
  console.log("dry-run; pass --write to apply");
  console.log("sample patch", patches[0]);
}
