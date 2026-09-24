#!/usr/bin/env node
/**
 * CRC/BCE 加练批次 → passed 发布：情景化、提示润色合并、style 轨。
 * 用法：node scripts/publish-workshop-crc-passed.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const srcPath = path.join(root, "content/workshop/new/20260913-CRC与BCE加练.jsonl");
const hintPath = path.join(root, "content/workshop/review/提示润色-20260913-CRC与BCE.jsonl");
const outPath = path.join(root, "content/workshop/new/20260913-CRC与BCE加练-passed.jsonl");

const PREFIX =
  "某市图书馆座位预约系统 OOA 工作坊中，分析师在 CRC/BCE 建模讨论时提出：";

const POINT_ALIAS = {
  BCE总作用: "BCE·职责切分",
  边界类作用: "BCE·边界类",
  控制类作用: "BCE·控制类",
  实体类作用: "BCE·实体类",
  CRC三栏: "CRC·三栏",
  CRC易混校验码: "CRC·与循环冗余校验区分",
};

function classifyStyle(stem) {
  const s = String(stem);
  const len = s.length;
  if (len <= 50) return "short";
  if (len >= 120) return "scenario";
  if (len > 45 && /某|项目|系统|电商|报修|图书馆|小程序/.test(s)) return "scenario";
  return "mid";
}

function needsPrefix(stem) {
  const s = String(stem);
  return s.length <= 48 && !/^某/.test(s) && !/电商|报修|图书馆|小程序/.test(s.slice(0, 20));
}

const hints = {};
if (fs.existsSync(hintPath)) {
  for (const line of fs.readFileSync(hintPath, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const o = JSON.parse(line);
    if (o.id && o.explain) hints[o.id] = o.explain;
  }
}

const rows = fs.readFileSync(srcPath, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const out = rows.map((q) => {
  let stem = q.stem;
  if (needsPrefix(stem)) stem = `${PREFIX}${stem}`;
  const point = POINT_ALIAS[q.point] || q.point;
  const explain = hints[q.id] || q.explain || q.exp || "";
  return {
    ...q,
    stem,
    point,
    explain,
    exp: explain,
    style_track: classifyStyle(stem),
    bank: "workshop",
    source: "出题工坊-CRC与BCE加练",
    reorganized_at: "2026-09-24",
    reorganized_pass: "CRC-BCE-passed-v1",
    review: "hint-officer+setter-v1",
  };
});

const st = {};
for (const q of out) st[q.style_track] = (st[q.style_track] || 0) + 1;
console.log({ n: out.length, styleTrack: st, hintsApplied: Object.keys(hints).length });

if (write) {
  fs.writeFileSync(outPath, out.map((q) => JSON.stringify(q)).join("\n") + "\n", "utf8");
  console.log("written", outPath);
} else {
  console.log("dry-run; pass --write");
}
