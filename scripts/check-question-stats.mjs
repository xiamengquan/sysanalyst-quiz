#!/usr/bin/env node
/** 校验题库统计口径与站点文案一致（1935 等） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metaPath = path.join(root, "public/data/question-meta.json");
const questionsPath = path.join(root, "public/data/questions.json");

if (!fs.existsSync(metaPath) || !fs.existsSync(questionsPath)) {
  console.error("check-question-stats: missing question-meta.json or questions.json");
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const rows = JSON.parse(fs.readFileSync(questionsPath, "utf8"));
const errors = [];

if (rows.length !== meta.total) {
  errors.push(`questions.json length (${rows.length}) ≠ meta.total (${meta.total})`);
}
const sum = (meta.practice || 0) + (meta.real || 0) + (meta.workshop || 0);
if (sum !== meta.total) {
  errors.push(`meta practice+real+workshop (${sum}) ≠ total (${meta.total})`);
}

const EXPECT_TOTAL = 1935;
if (meta.total !== EXPECT_TOTAL) {
  errors.push(`expected total ${EXPECT_TOTAL}, got ${meta.total} (run npm run sync:data if intentional)`);
}

if (errors.length) {
  console.error("check-question-stats failed:\n" + errors.map((e) => `  ${e}`).join("\n"));
  process.exit(1);
}
console.log(`check-question-stats ok · total ${meta.total} (practice ${meta.practice}, real ${meta.real}, workshop ${meta.workshop})`);
