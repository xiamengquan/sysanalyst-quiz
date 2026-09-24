#!/usr/bin/env node
/** 去除题干中重复的情景前缀（B34 叠化修复） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");

function dedupeStem(stem) {
  let s = String(stem || "");
  // 已知情景前缀叠化（最长优先）
  const prefixes = [
    "某连锁商超门店库存与会员运营数字化项目中，业务分析师记录到：",
    "某市「政务服务一网通办」二期项目组在需求研讨会上提出：",
    "某银行日终批处理与对账系统的需求分析会上，团队确认：",
    "某省标准化技术委员会审定文件层级时指出：",
    "某开源软件基金会发布组件新版本，合规审查会上讨论：",
  ].sort((a, b) => b.length - a.length);
  for (const p of prefixes) {
    while (s.includes(p + p)) s = s.replace(p + p, p);
    const p2 = p.replace(/：$/, "，");
    if (s.includes(p + p2)) s = s.replace(p + p2, p);
  }
  return s.replace(/：：+/g, "：").replace(/，需判断：，需判断：/g, "，需判断：").trim();
}

function processFile(rel) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) return 0;
  const lines = fs.readFileSync(fp, "utf8").split(/\r?\n/).filter(Boolean);
  let n = 0;
  const out = lines.map((line) => {
    const q = JSON.parse(line);
    const next = dedupeStem(q.stem);
    if (next !== q.stem) {
      n += 1;
      q.stem = next;
    }
    return JSON.stringify(q);
  });
  if (write && n) fs.writeFileSync(fp, out.join("\n") + "\n", "utf8");
  return n;
}

const targets = [
  "content/banks/practice/all.jsonl",
  ...fs
    .readdirSync(path.join(root, "content/workshop/new"))
    .filter((n) => n.endsWith(".jsonl") && !n.includes(".bak"))
    .map((n) => `content/workshop/new/${n}`),
];

let total = 0;
for (const t of targets) total += processFile(t);
console.log({ fixed: total, write });
