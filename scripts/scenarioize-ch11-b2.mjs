#!/usr/bin/env node
/**
 * Phase B2：第 11 章短题干情景化（不重写选项/答案），并补 learn_path。
 * 用法：node scripts/scenarioize-ch11-b2.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bankPath = path.join(root, "content/banks/practice/all.jsonl");
const patchPath = path.join(
  root,
  "docs/question-workshop/reports/data/重编-20260924-批次B2-ch11-stem-patches.jsonl",
);
const write = process.argv.includes("--write");

const SCENE = {
  gov: "某市「政务服务一网通办」二期项目组在需求研讨会上提出：",
  retail: "某连锁商超门店库存与会员运营数字化项目中，业务分析师记录到：",
  batch: "某银行日终批处理与对账系统的需求分析会上，团队确认：",
  saoDfd: "上述系统的结构化分析工作坊中，分析师核对数据流图时问：",
  saoUc: "同一项目的用例建模评审会上，产品经理强调：",
  change: "需求基线发布之后，变更控制委员会评估一项范围变更时指出：",
  verify: "测试负责人对照 SRS 做需求确认与验证时，需要判断：",
  acquire: "需求获取阶段，分析师选择调研方法时面临情境：",
};

function hashPick(id, keys) {
  const h = crypto.createHash("md5").update(id).digest();
  return keys[h[0] % keys.length];
}

function isScenarioStem(stem) {
  const s = String(stem || "");
  return s.length > 52 && /某|项目|公司|企业|单位|平台|系统升级|项目组/.test(s);
}

function pickPrefix(q) {
  const p = String(q.point || "");
  const stem = String(q.stem || "");
  const lp = q.learn_path;

  if (/变更|基线|冻结|跟踪|追溯|假设与依赖|优先级/.test(p + stem)) return SCENE.change;
  if (/验证|验收|可验证|可检验|确认/.test(p + stem)) return SCENE.verify;
  if (/获取|访谈|问卷|JRP|观察|文档分析|五法|原型/.test(p + stem)) return SCENE.acquire;

  if (lp === "sao" || /SAO|DFD|STD|字典|结构化|OOA|用例|BCE|加工|数据流/.test(p + stem)) {
    if (/用例|参与者|OOA|事件流|BCE|边界类/.test(p + stem)) return SCENE.saoUc;
    if (/DFD|字典|STD|加工|数据流|外部实体|数据存储/.test(p + stem)) return SCENE.saoDfd;
    if (/批处理|账单|报表|结算/.test(stem)) return SCENE.batch;
    return hashPick(q.id, [SCENE.saoDfd, SCENE.saoUc, SCENE.batch]);
  }

  if (/批处理|账单|文件输入|汇总报表/.test(stem)) return SCENE.batch;
  return hashPick(q.id, [SCENE.gov, SCENE.retail, SCENE.batch]);
}

function scenarioizeStem(q) {
  let stem = String(q.stem || "").trim();
  if (isScenarioStem(stem)) return stem;

  const prefix = pickPrefix(q);
  if (stem.startsWith("下列") || stem.startsWith("「")) {
    return `${prefix.slice(0, -1)}，需判断：${stem}`;
  }
  return `${prefix}${stem}`;
}

function classifyStyleTrack(stem) {
  const s = String(stem || "");
  const len = s.length;
  if (len <= 50) return "short";
  if (len >= 142) return "scenario";
  if (len > 40 && /某|项目|公司|系统|平台|企业|单位|中心|团队|某市|某省|银行|商超|项目组/.test(s)) {
    return "scenario";
  }
  return "mid";
}

function inferLearnPath(q) {
  if (q.learn_path) return q.learn_path;
  const src = String(q.source || "");
  const p = String(q.point || "");
  if (src.includes("结构化") || src.includes("OO") || /^SAO|SA|OOA|DFD|用例|STD/.test(p)) return "sao";
  return "req";
}

/** 与第11章精炼小节对齐的 point 微调（仅明显别名） */
const POINT_ALIAS = {
  "需求三层": "三层需求",
  需求层次: "三层需求",
  五活动: "需求工程五活动",
  需求开发阶段: "需求开发四阶段",
  "范围vs需求": "范围 vs 需求",
  "用户vs系统需求": "用户需求 vs 系统需求",
  原始需求vsSRS: "原始需求 vs SRS",
  QFD常规: "QFD·常规需求",
  QFD期望: "QFD·期望需求",
  QFD意外: "QFD·兴奋需求",
  FURPS功能: "FURPS·功能性",
  "FURPS+": "FURPS+",
  好需求可验证: "好需求·可验证",
  好需求无歧义: "好需求·无歧义",
  SAvsOOA: "SA 与 OOA 对比",
  SA定义: "结构化分析 SA",
  OOA定义: "面向对象分析 OOA",
};

const lines = fs.readFileSync(bankPath, "utf8").split(/\r?\n/).filter(Boolean);
const patches = [];
let stemChanged = 0;
let pointChanged = 0;

const outLines = lines.map((line) => {
  const q = JSON.parse(line);
  const ch = q.chapter ?? q.ch ?? 0;
  if (ch !== 11) return line;

  const before = { stem: q.stem, point: q.point, style_track: q.style_track, learn_path: q.learn_path };
  q.learn_path = inferLearnPath(q);

  const alias = POINT_ALIAS[q.point];
  if (alias && alias !== q.point) {
    q.point = alias;
    pointChanged += 1;
  }

  const newStem = scenarioizeStem(q);
  if (newStem !== q.stem) {
    q.stem = newStem;
    stemChanged += 1;
  }
  q.style_track = classifyStyleTrack(q.stem);
  q.reorganized_pass = "meta-v1+B1-explain+B2-ch11";
  q.reorganized_at = "2026-09-24";

  if (
    before.stem !== q.stem ||
    before.point !== q.point ||
    before.style_track !== q.style_track ||
    before.learn_path !== q.learn_path
  ) {
    patches.push({
      id: q.id,
      stem_before: before.stem,
      stem: q.stem,
      point_before: before.point,
      point: q.point,
      style_track: q.style_track,
      learn_path: q.learn_path,
      phase: "B2-ch11-scenario",
    });
  }
  return JSON.stringify(q);
});

const ch11 = outLines.map((l) => JSON.parse(l)).filter((q) => (q.chapter ?? q.ch) === 11);
const st = { short: 0, mid: 0, scenario: 0 };
for (const q of ch11) st[q.style_track] = (st[q.style_track] || 0) + 1;

console.log({ ch11: ch11.length, stemChanged, pointChanged, styleTrack: st, patches: patches.length });

if (write) {
  fs.writeFileSync(bankPath, outLines.join("\n") + "\n", "utf8");
  fs.writeFileSync(patchPath, patches.map((p) => JSON.stringify(p)).join("\n") + "\n", "utf8");
  console.log("written", bankPath, patchPath);
} else {
  console.log("dry-run; pass --write");
  if (patches[0]) console.log("sample", patches[0]);
}
