#!/usr/bin/env node
/** 抽检考点「应试」节中的 chapter= / bank= 练题链接是否合法 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pointsDir = path.join(root, "content/kb/points");
const questions = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/questions.json"), "utf8"),
);
const chSet = new Set(questions.map((q) => q.ch));

const warnings = [];
const linkRe = /\[([^\]]*)\]\((\/?\?[^)]+)\)/g;

for (const f of fs.readdirSync(pointsDir)) {
  if (!f.startsWith("kp-") || !f.endsWith(".md")) continue;
  const t = fs.readFileSync(path.join(pointsDir, f), "utf8");
  const exam = t.match(/## 应试\n\n([\s\S]*?)\n\n## /);
  if (!exam) continue;
  const block = exam[1];
  let m;
  while ((m = linkRe.exec(block))) {
    const href = m[2];
    const chM = href.match(/chapter=(\d+)/);
    if (chM) {
      const ch = Number(chM[1]);
      if (!chSet.has(ch) && ch !== 99) {
        warnings.push(`${f}: chapter=${ch} has no questions in index`);
      }
    }
  }
}

if (warnings.length > 8) {
  console.warn(`check-kb-exam-links: ${warnings.length} warnings (showing 8)`);
  warnings.slice(0, 8).forEach((w) => console.warn(" ", w));
} else if (warnings.length) {
  console.warn("check-kb-exam-links warns:");
  warnings.forEach((w) => console.warn(" ", w));
} else {
  console.log("check-kb-exam-links ok");
}
