#!/usr/bin/env node
/**
 * 发版门禁 · 追溯矩阵（P1-A4）：
 * 每个考点配置项须四向可追溯，任一断链即拦截发版——
 *   考点 → 题组   tracks.json 点内题组非空（check-tracks 已覆盖，此处复核汇总）
 *   考点 → 卡组   课程日次（course.day）在 flashcards.json 中有 ≥1 张卡，且含 ≥1 张 M 必会卡
 *   考点 → 总册   域 id 在重学锚点表（KB_ANCHOR）中有落点，风险项「重学」按钮不落空
 *   逆 向        flashcards 中 day 值必须落在 d1–d7 或 null，防「筛不到的孤儿卡」
 * 用法：node scripts/check-traceability.mjs
 * 注意：KB_ANCHOR 与 src/lib/se-system.ts 的同名表保持一致，改动须双向同步。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

/** 域 → 总册重学锚点（与 src/lib/se-system.ts KB_ANCHOR 一致） */
const KB_ANCHOR = {
  req: "/kb/quick-four-tier-7d/#d2",
  web: "/kb/quick-four-tier-7d/#d3",
  mic: "/kb/quick-four-tier-7d/#d3",
  db: "/kb/quick-four-tier-7d/#d4",
  mod: "/kb/quick-four-tier-7d/#d1",
};

const VALID_DAYS = new Set(["d1", "d2", "d3", "d4", "d5", "d6", "d7"]);

function main() {
  const errors = [];
  const tracks = readJson("public/data/tracks.json");
  const flash = readJson("public/data/flashcards.json");
  const cards = flash?.cards ?? [];

  // 按日次聚合卡组
  const cardsByDay = new Map();
  for (const c of cards) {
    if (c.day != null && !VALID_DAYS.has(c.day)) {
      errors.push(`孤儿卡 ${c.id}：day="${c.day}" 不在 d1–d7（/recall/?day= 深链筛不到）`);
      continue;
    }
    if (c.day) {
      if (!cardsByDay.has(c.day)) cardsByDay.set(c.day, { total: 0, m: 0 });
      cardsByDay.get(c.day).total++;
      if (c.tier === "M") cardsByDay.get(c.day).m++;
    }
  }

  let pointCount = 0;
  let pointWithQuestions = 0;
  for (const course of tracks.courses ?? []) {
    // —— 考点 → 总册锚点 ——
    if (!KB_ANCHOR[course.id]) {
      errors.push(`${course.title}（${course.id}）：KB_ANCHOR 无重学锚点——风险项「重学」将落空，请在 se-system.ts 补映射`);
    }
    // —— 考点 → 卡组（课程日次 ≥1 卡，且含 ≥1 张 M 必会卡） ——
    if (!course.day || !VALID_DAYS.has(course.day)) {
      errors.push(`${course.title}（${course.id}）：day="${course.day ?? "空"}" 无效，卡组/深链不可达`);
    } else {
      const bucket = cardsByDay.get(course.day);
      if (!bucket || bucket.total < 1) {
        errors.push(`${course.title}（${course.id}）：卡组断链——flashcards.json 中 day=${course.day} 无任何卡片`);
      } else if (bucket.m < 1) {
        errors.push(`${course.title}（${course.id}）：卡组无 M 必会卡——day=${course.day} 仅 ${bucket.total} 张 K 卡，缺总册默写锚点`);
      }
    }
    // —— 考点 → 题组（复核汇总；逐点细则由 check-tracks 门禁把关） ——
    for (const unit of course.units ?? []) {
      for (const p of unit.points ?? []) {
        pointCount++;
        const qCount = ["choice", "fill", "short", "bool", "match", "order"].reduce(
          (n, k) => n + (Array.isArray(p[k]) ? p[k].length : 0),
          0
        );
        if (qCount > 0) pointWithQuestions++;
        else errors.push(`考点 ${p.id}（${p.title}）：题组断链——点内无任何题目`);
      }
    }
  }

  if (errors.length) {
    console.error("check-traceability 失败：");
    for (const e of errors) console.error(" - " + e);
    process.exit(1);
  }
  console.log(
    `check-traceability ok · points ${pointWithQuestions}/${pointCount} 有题 · courses ${(tracks.courses ?? []).length} · cards ${cards.length}（日次覆盖 ${cardsByDay.size}/7）`
  );
}

main();
