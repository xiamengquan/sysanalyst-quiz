#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEW = path.join(root, "content/workshop/new");
const write = process.argv.includes("--write");

function classify(stem) {
  const s = String(stem || "");
  const len = s.length;
  if (len <= 50) return "short";
  if (len >= 120) return "scenario";
  if (len > 45 && /某|项目|公司|系统|平台/.test(s)) return "scenario";
  return "mid";
}

const names = fs.readdirSync(NEW).filter((n) => n.endsWith("-passed.jsonl") && !n.startsWith("重写"));
for (const name of names) {
  const fp = path.join(NEW, name);
  const rows = fs.readFileSync(fp, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  const minShort = Math.max(1, Math.ceil(rows.length * 0.2));
  rows.sort((a, b) => String(a.stem).length - String(b.stem).length);
  const shortIds = new Set(rows.slice(0, minShort).map((q) => q.id));
  for (const q of rows) {
    q.style_track = shortIds.has(q.id) ? "short" : classify(q.stem);
    q.reorganized_pass = "B34-scenario";
    q.reorganized_at = "2026-09-24";
  }
  const st = {};
  for (const q of rows) st[q.style_track] = (st[q.style_track] || 0) + 1;
  console.log(name, rows.length, st);
  if (write) fs.writeFileSync(fp, rows.map((q) => JSON.stringify(q)).join("\n") + "\n", "utf8");
}
