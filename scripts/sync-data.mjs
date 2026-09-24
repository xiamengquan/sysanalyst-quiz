#!/usr/bin/env node
/**
 * Build public/data/questions.json + cases.json from content/banks + workshop.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BANKS = path.join(ROOT, "content/banks");
const NEW = path.join(ROOT, "content/workshop/new");
const REVIEW = path.join(ROOT, "content/workshop/review");
const OUT = path.join(ROOT, "public/data");

function loadJsonl(fp) {
  if (!fs.existsSync(fp)) return [];
  return fs
    .readFileSync(fp, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function writeJson(fp, data) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data), "utf8");
}

function buildQuestions() {
  // 出题细则 §3.1：上午选择题 chapter∈{0…15}；§3.3 论文不纳入
  const practice = loadJsonl(path.join(BANKS, "practice/all.jsonl"))
    .filter((o) => {
      const ch = o.chapter ?? o.ch ?? 0;
      return ch >= 0 && ch <= 15;
    })
    .map((o) => ({
      no: o.no,
      ch: o.chapter ?? o.ch ?? 0,
      point: o.point || "",
      stem: o.stem,
      opts: o.options || o.opts,
      ans: o.answer || o.ans,
      exp: o.explain || o.exp || "",
      diff: o.difficulty || o.diff || "basic",
      bank: "practice",
      source: "自编练习",
      year: "",
      id: o.id,
      origin_chapter: o.origin_chapter,
      audience: o.audience,
      math_level: o.math_level,
      intensity: o.intensity,
      style_track: o.style_track,
      learn_path: o.learn_path,
      learn_stage: o.learn_stage,
    }));

  // 综合知识真题唯一权威源（数据版）；上午真题.jsonl 仅作兼容镜像
  const realPrimary = path.join(BANKS, "real/综合知识/all.jsonl");
  const realFallback = path.join(BANKS, "real/上午真题.jsonl");
  const realPath = fs.existsSync(realPrimary) ? realPrimary : realFallback;
  if (!fs.existsSync(realPath)) {
    console.warn("no real MCQ bank at", realPrimary);
  }
  const real = loadJsonl(realPath).map((q, i) => ({
    no: 100000 + i + 1,
    ch: 99,
    point: `${q.year || ""}${q.half || ""}·第${q.qnum || ""}题${q.blank ? `·空${q.blank}` : ""}`,
    stem: q.stem,
    opts: q.opts,
    ans: q.ans,
    exp: q.exp || "",
    diff: "real",
    bank: "real",
    source: q.source || "综合知识真题",
    year: String(q.year || ""),
    half: q.half || "",
    qnum: q.qnum,
    id: q.id,
    edition: q.edition || "data-v1",
    opt_exp: q.opt_exp || undefined,
    exp_edition: q.exp_edition || undefined,
  }));

  const reject = new Set();
  const rejFile = path.join(REVIEW, "reject-ids.txt");
  if (fs.existsSync(rejFile)) {
    for (const ln of fs.readFileSync(rejFile, "utf8").split(/\r?\n/)) {
      if (ln.trim()) reject.add(ln.trim());
    }
  }

  const candidates = fs.existsSync(NEW)
    ? fs.readdirSync(NEW).filter((n) => n.endsWith(".jsonl") && !n.startsWith("重写") && !n.includes(".bak"))
    : [];
  const passedNames = new Set(candidates.filter((n) => n.endsWith("-passed.jsonl")));
  const files = [];
  for (const name of candidates.sort()) {
    if (name.endsWith("-passed.jsonl")) {
      files.push(name);
      continue;
    }
    const stem = name.replace(/\.jsonl$/, "");
    if (passedNames.has(`${stem}-passed.jsonl`)) continue;
    files.push(name);
  }

  const workshop = [];
  let n = 200000;
  for (const name of files) {
    const rows = loadJsonl(path.join(NEW, name));
    rows.forEach((o, i) => {
      const qid = o.id || `${path.basename(name, ".jsonl")}-${String(i + 1).padStart(2, "0")}`;
      if (reject.has(qid) && !name.includes("passed")) return;
      n += 1;
      workshop.push({
        no: n,
        ch: o.chapter ?? 0,
        point: o.point || "",
        stem: o.stem,
        opts: o.options || o.opts,
        ans: o.answer || o.ans,
        exp: o.explain || o.exp || "",
        diff: o.difficulty || "deep",
        bank: "workshop",
        source: o.source || path.basename(name, ".jsonl"),
        year: "",
        id: qid,
        origin_chapter: o.origin_chapter,
        audience: o.audience,
        intensity: o.intensity,
        style_track: o.style_track,
        learn_path: o.learn_path,
        learn_stage: o.learn_stage,
      });
    });
  }

  // 工坊题同样拦截 16–22（论文/案例主章节号）
  const workshopOk = workshop.filter((q) => q.ch >= 0 && q.ch <= 15);

  const combined = [...practice, ...real, ...workshopOk];
  const meta = {
    practice: practice.length,
    real: real.length,
    workshop: workshopOk.length,
    total: combined.length,
  };
  writeJson(path.join(OUT, "questions.json"), combined);
  writeJson(path.join(OUT, "question-meta.json"), meta);
  return meta;
}

function copyCasePacks() {
  const practicePack = path.join(BANKS, "cases/packs/wuxuan-san.json");
  const realDir = path.join(BANKS, "real/案例分析");
  fs.mkdirSync(OUT, { recursive: true });
  let packs = [];
  if (fs.existsSync(realDir)) {
    const realPacks = fs
      .readdirSync(realDir)
      .filter((n) => n.endsWith("-pack.json"))
      .sort()
      .reverse() // 新卷在前
      .map((n) => JSON.parse(fs.readFileSync(path.join(realDir, n), "utf8")));
    packs = packs.concat(realPacks);
  }
  if (fs.existsSync(practicePack)) {
    const data = JSON.parse(fs.readFileSync(practicePack, "utf8"));
    packs = packs.concat(Array.isArray(data.packs) ? data.packs : []);
  }
  if (!packs.length) return;
  writeJson(path.join(OUT, "case-packs.json"), { version: "v1", packs });
}

function summarizeCases(rows) {
  const domains = {};
  const types = {};
  let practice = 0;
  let real = 0;
  for (const c of rows) {
    domains[c.domain] = (domains[c.domain] || 0) + 1;
    types[c.case_type] = (types[c.case_type] || 0) + 1;
    if (c.bank === "real") real += 1;
    else practice += 1;
  }
  return {
    practice,
    real,
    total: rows.length,
    domains,
    types,
    tracks: rows.reduce((acc, c) => {
      const t = c.track || "—";
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {}),
  };
}

function buildCases() {
  // Prefer regenerating practice from MD via Python; then append real 真题
  const py = path.join(ROOT, "scripts/python/build_cases_jsonl.py");
  let practiceRows = [];
  if (fs.existsSync(py)) {
    const r = spawnSync("python3", [py], { cwd: ROOT, stdio: "inherit" });
    if (r.status !== 0) {
      console.warn("build_cases_jsonl.py failed, falling back to all.jsonl");
      practiceRows = loadJsonl(path.join(BANKS, "cases/all.jsonl"));
    } else {
      practiceRows = loadJsonl(path.join(BANKS, "cases/all.jsonl"));
    }
  } else {
    practiceRows = loadJsonl(path.join(BANKS, "cases/all.jsonl"));
  }
  for (const c of practiceRows) {
    if (!c.bank) c.bank = "practice";
    c.reorganized_at = c.reorganized_at || "2026-09-24";
    c.reorganized_pass = c.reorganized_pass || "phase-D-audit-ok";
  }

  const realRows = loadJsonl(path.join(BANKS, "real/案例分析/all.jsonl"));
  const rows = [...practiceRows, ...realRows];
  writeJson(path.join(OUT, "cases.json"), rows);
  writeJson(path.join(OUT, "case-meta.json"), summarizeCases(rows));
  copyCasePacks();
}

function copyPaperBank() {
  const src = path.join(BANKS, "paper/all.jsonl");
  if (!fs.existsSync(src)) return;
  const rows = loadJsonl(src).map((r) => ({
    ...r,
    reorganized_at: r.reorganized_at || "2026-09-24",
    reorganized_pass: r.reorganized_pass || "phase-D-audit-ok",
  }));
  writeJson(path.join(OUT, "paper.json"), rows);
}

function main() {
  const qMeta = buildQuestions();
  buildCases();
  copyPaperBank();
  console.log({ questions: qMeta, cases: "public/data/cases.json", paper: "public/data/paper.json" });
}

main();
