#!/usr/bin/env node
/**
 * 发版门禁 · 答题轨道：
 * 1) 重建校验（与 build-tracks 同规）：每点 ≥1 选择 + ≥1 填空、qmap 全覆盖、案例 md 存在；
 * 2) 案例已落库：content/banks/cases/all.jsonl 中存在 caseSet.id 对应记录（须先跑 python 再查）；
 * 3) 产物一致：public/data/tracks.json 的 meta 与源统计一致。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function runBuild() {
  const r = execFileSync(process.execPath, [path.join(__dirname, "build-tracks.mjs")], { encoding: "utf8" });
  return r.trim();
}

function main() {
  const errors = [];
  const log = runBuild(); // 重建 + 全量校验，失败即抛
  const tracks = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/tracks.json"), "utf8"));
  const allPath = path.join(ROOT, "content/banks/cases/all.jsonl");
  const rows = fs.existsSync(allPath)
    ? fs.readFileSync(allPath, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l))
    : [];
  const byId = new Map(rows.map((c) => [c.id, c]));
  for (const course of tracks.courses) {
    const c = byId.get(course.caseSet.id);
    if (!c) {
      errors.push(`${course.title}: 案例未落库（all.jsonl 缺 ${course.caseSet.id}）——先跑 npm run sync:data`);
    } else {
      const qnums = Object.keys(course.caseSet.qmap).map(Number);
      const caseQnums = (c.questions ?? []).map((q) => q.qnum);
      for (const q of qnums) if (!caseQnums.includes(q)) errors.push(`${course.caseSet.id} 缺第 ${q} 问（qmap 指空）`);
      if (!c.stem || (c.questions ?? []).length < 3) errors.push(`${course.caseSet.id} 题干或问题数不足`);
    }
  }
  if (errors.length) {
    console.error("check-tracks 失败：");
    for (const e of errors) console.error(" - " + e);
    process.exit(1);
  }
  console.log(`check-tracks ok · ${log}`);
}

main();
