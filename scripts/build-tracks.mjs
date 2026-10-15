#!/usr/bin/env node
/**
 * Build public/data/tracks.json from content/tracks/*.json（答题轨道 · Duolingo 式背诵）
 * 校验：每点 ≥1 选择题 + ≥1 填空题；caseSet.qmap 全覆盖本域知识点；对应案例 md 存在。
 * 深度校验（含案例文件落库）在 check-tracks.mjs（发版门禁）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "content/tracks");
const CASE_DIR = path.join(ROOT, "content/banks/cases");
const OUT = path.join(ROOT, "public/data/tracks.json");

const ORDER = ["需求工程", "Web", "微服务", "数据库"];

/** 校验并归一一门课程 */
function validateCourse(course) {
  const errs = [];
  const ids = new Set();
  let points = 0;
  let choice = 0;
  let fill = 0;
  let short = 0;
  let bool = 0;
  let match = 0;
  let order = 0;
  for (const unit of course.units ?? []) {
    if (!unit.id || !unit.title) errs.push(`${course.id}: unit 缺 id/title`);
    for (const p of unit.points ?? []) {
      points += 1;
      if (!p.id || ids.has(p.id)) errs.push(`${course.id}: point id 缺失或重复 ${p.id}`);
      ids.add(p.id);
      if (!p.title || !p.core || !p.hook) errs.push(`${p.id}: 缺 title/core/hook`);
      if (!p.choice?.length) errs.push(`${p.id}: 缺选择题`);
      for (const c of p.choice ?? []) {
        if (!Array.isArray(c.options) || c.options.length !== 4) errs.push(`${p.id}: 选择题须 4 个选项`);
        if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer >= (c.options?.length ?? 0))
          errs.push(`${p.id}: 选择题 answer 越界`);
        if (!c.explain) errs.push(`${p.id}: 选择题缺 explain`);
        choice += 1;
      }
      if (!p.fill?.length) errs.push(`${p.id}: 缺填空题`);
      for (const f of p.fill ?? []) {
        if (!f.blanks?.length || f.blanks.some((b) => !b?.length)) errs.push(`${p.id}: 填空题 blanks 空`);
        if (!f.explain) errs.push(`${p.id}: 填空题缺 explain`);
        fill += 1;
      }
      if (!p.short?.length) errs.push(`${p.id}: 缺简答题`);
      for (const s of p.short ?? []) {
        if (!s.q) errs.push(`${p.id}: 简答题缺题干 q`);
        if (!s.reference) errs.push(`${p.id}: 简答题缺 reference`);
        short += 1;
      }
      if (!p.bool?.length) errs.push(`${p.id}: 缺判断题`);
      for (const b of p.bool ?? []) {
        if (typeof b.answer !== "boolean") errs.push(`${p.id}: 判断题 answer 须为 boolean`);
        if (!b.explain) errs.push(`${p.id}: 判断题缺 explain`);
        bool += 1;
      }
      for (const m of p.match ?? []) {
        if (!m.title) errs.push(`${p.id}: 配对题缺 title`);
        if (!Array.isArray(m.pairs) || m.pairs.length < 3 || m.pairs.length > 6) errs.push(`${p.id}: 配对题 pairs 须 3–6 对`);
        else if (m.pairs.some(([l, r]) => !l || !r)) errs.push(`${p.id}: 配对题存在空项`);
        if (!m.explain) errs.push(`${p.id}: 配对题缺 explain`);
        match += 1;
      }
      for (const o of p.order ?? []) {
        if (!o.title) errs.push(`${p.id}: 排序题缺 title`);
        if (!Array.isArray(o.steps) || o.steps.length < 3 || o.steps.length > 8) errs.push(`${p.id}: 排序题 steps 须 3–8 步`);
        if (!o.explain) errs.push(`${p.id}: 排序题缺 explain`);
        order += 1;
      }
    }
  }
  // 配对/排序是域级题型：本域需 ≥2 道，挂在任意点下均可
  if (match < 2) errs.push(`${course.id}: 配对题不足 2 道（现有 ${match}）`);
  if (order < 2) errs.push(`${course.id}: 排序题不足 2 道（现有 ${order}）`);
  // caseSet 覆盖矩阵：本域每点都应出现在 qmap 中；且对应案例 md 存在
  const cs = course.caseSet;
  if (!cs?.id) errs.push(`${course.id}: 缺 caseSet.id`);
  const covered = new Set();
  for (const list of Object.values(cs?.qmap ?? {})) for (const pid of list ?? []) covered.add(pid);
  for (const pid of ids) if (!covered.has(pid)) errs.push(`${course.id}: ${pid} 未被案例题覆盖（qmap 缺口）`);
  for (const pid of covered) if (!ids.has(pid)) errs.push(`${course.id}: qmap 引用了不存在的 ${pid}`);
  if (cs?.id) {
    const no = Number(String(cs.id).replace(/^CA-/, ""));
    if (!Number.isInteger(no) || !fs.existsSync(path.join(CASE_DIR, `案例${no}.md`)))
      errs.push(`${course.id}: 案例源文件不存在 ${cs.id}`);
  }
  return { errs, stats: { points, choice, fill, short, bool, match, order } };
}

function main() {
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".json"));
  const byTitle = new Map(files.map((f) => [path.basename(f, ".json"), JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"))]));
  const courses = [];
  const errs = [];
  const meta = { courses: 0, units: 0, points: 0, choice: 0, fill: 0, short: 0, bool: 0, match: 0, order: 0 };
  for (const title of ORDER) {
    const course = byTitle.get(title);
    if (!course) {
      errs.push(`缺课程文件: content/tracks/${title}.json`);
      continue;
    }
    const v = validateCourse(course);
    errs.push(...v.errs);
    meta.courses += 1;
    meta.units += course.units.length;
    meta.points += v.stats.points;
    meta.choice += v.stats.choice;
    meta.fill += v.stats.fill;
    meta.short += v.stats.short;
    meta.bool += v.stats.bool;
    meta.match += v.stats.match;
    meta.order += v.stats.order;
    courses.push({
      id: course.id,
      title: course.title,
      tagline: course.tagline,
      day: course.day,
      caseSet: {
        id: course.caseSet.id,
        title: course.caseSet.title,
        href: `/case/?id=${encodeURIComponent(course.caseSet.id)}`,
        qmap: course.caseSet.qmap,
      },
      units: course.units.map((u) => ({ id: u.id, title: u.title, points: u.points })),
    });
  }
  // 未知多余课程文件也纳入（防漏发）
  for (const [title, course] of byTitle) {
    if (ORDER.includes(title)) continue;
    errs.push(`未注册课程文件（ORDER 缺失）: ${title}`);
    const v = validateCourse(course);
    errs.push(...v.errs);
  }
  if (errs.length) {
    console.error("build-tracks 校验失败：");
    for (const e of errs) console.error(" - " + e);
    process.exit(1);
  }
  const out = { meta: { builtAt: new Date().toISOString(), ...meta }, courses };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out), "utf8");
  console.log(`build-tracks ok · courses ${meta.courses} · units ${meta.units} · points ${meta.points} · choice ${meta.choice} · fill ${meta.fill} · short ${meta.short} · bool ${meta.bool} · match ${meta.match} · order ${meta.order}`);
}

main();
