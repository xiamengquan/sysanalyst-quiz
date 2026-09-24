#!/usr/bin/env node
/**
 * 真题规律统计（仅 real/综合知识/all.jsonl），输出 JSON 供分析师/委员会引用。
 * 用法：node scripts/analyze-real-patterns.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realPath = path.join(root, "content/banks/real/综合知识/all.jsonl");
const practicePath = path.join(root, "content/banks/practice/all.jsonl");
const outDir = path.join(root, "docs/question-workshop/reports/data");
const outFile = path.join(outDir, "真题规律统计-2026-09-24.json");

function load(fp) {
  if (!fs.existsSync(fp)) return [];
  return fs.readFileSync(fp, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
}

function stemMetrics(stem) {
  const s = String(stem || "");
  return {
    len: s.length,
    shortExam: s.length <= 50,
    longStem: s.length >= 142,
    blank: /（\d+）|\(\d+\)/.test(s),
    multiBlank: (s.match(/（\d+）|\(\d+\)/g) || []).length >= 2,
    scenario: /某|项目|公司|系统|平台|企业|单位|中心|团队|单位拟|某市|某省/.test(s) && s.length > 40,
    template:
      /关于.*下列说法|以下.*正确的是|不正确的是|错误的是/.test(s) &&
      !/某|项目|公司/.test(s),
    calc: /计算|求|公式|SPI|CPI|EV|PV|BAC|掩码|子网|概率|期望|带宽|时延|复杂度|O\(/.test(s),
    negate: /不属于|不正确|错误的是|不包括|除外|EXCEPT/i.test(s),
    compare: /对比|区别|相比|不同于|优缺点|差异/.test(s),
  };
}

function aggregate(rows, label) {
  const n = rows.length;
  const m = {
    label,
    n,
    byYear: {},
    stemLen: { sum: 0, median: 0, p90: 0 },
    rates: {},
  };
  const lens = [];
  const flags = {
    shortExam: 0,
    longStem: 0,
    blank: 0,
    multiBlank: 0,
    scenario: 0,
    template: 0,
    calc: 0,
    negate: 0,
    compare: 0,
  };
  for (const q of rows) {
    const y = `${q.year || "?"}${q.half || ""}`;
    m.byYear[y] = (m.byYear[y] || 0) + 1;
    const x = stemMetrics(q.stem);
    lens.push(x.len);
    m.stemLen.sum += x.len;
    for (const k of Object.keys(flags)) if (x[k]) flags[k] += 1;
  }
  lens.sort((a, b) => a - b);
  m.stemLen.median = lens[Math.floor(lens.length / 2)] || 0;
  m.stemLen.p90 = lens[Math.floor(lens.length * 0.9)] || 0;
  m.stemLen.mean = n ? m.stemLen.sum / n : 0;
  for (const [k, v] of Object.entries(flags)) {
    m.rates[k] = n ? Number(((100 * v) / n).toFixed(1)) : 0;
  }
  return m;
}

function practiceGap(practice, realAgg) {
  const n = practice.length;
  let shortExp = 0;
  let template = 0;
  const style = { short: 0, mid: 0, scenario: 0, other: 0 };
  for (const q of practice) {
    const exp = String(q.explain || q.exp || "");
    if (exp.length < 35) shortExp += 1;
    if (/下列说法正确的是/.test(q.stem || "")) template += 1;
    const st = q.style_track || "other";
    if (st in style) style[st] += 1;
    else style.other += 1;
  }
  return {
    n,
    shortExplainLt35: shortExp,
    shortExplainRate: n ? Number(((100 * shortExp) / n).toFixed(1)) : 0,
    templateStem: template,
    styleTrack: style,
    targetStyleFromReal: {
      shortExamPct: realAgg.rates.shortExam,
      longStemPct: realAgg.rates.longStem,
      scenarioPct: realAgg.rates.scenario,
      calcPct: realAgg.rates.calc,
      negatePct: realAgg.rates.negate,
    },
  };
}

const real = load(realPath);
const practice = load(practicePath);
const formalYears = new Set(["2018", "2019", "2020", "2021", "2022", "2023"]);
const formal = real.filter((q) => formalYears.has(String(q.year || "")));

const report = {
  generatedAt: "2026-09-24",
  realPath: "content/banks/real/综合知识/all.jsonl",
  practicePath: "content/banks/practice/all.jsonl",
  realAll: aggregate(real, "real-all"),
  realFormal2018_2023: aggregate(formal, "real-formal-2018-2023"),
  practiceGap: practiceGap(practice, aggregate(real, "real-all")),
  conclusions: [
    "真题记录级多空联动仍占绝对主导（blank 标记接近全量）；叙述情景约三成，与「长题干≠情景」口径须分开引用。",
    "2025 回忆卷及近年卷短题干占比上升，自编库须保留 short/mid/scenario 三轨并按 §4 配额混排。",
    "自编库当前 short 轨占比偏高、scenario 轨偏低；解析 <35 字仍有一批待清零（重编 Phase B）。",
    "非真题重编须仅模仿规律，禁止照搬真题原文；考点对齐知识点精炼 v1.0+ 与 §3.0 章映射。",
  ],
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
console.log("wrote", outFile);
console.log(JSON.stringify({ real: report.realAll.n, formal: report.realFormal2018_2023.n, practice: report.practiceGap.n }, null, 2));
