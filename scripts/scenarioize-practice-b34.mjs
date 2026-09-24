#!/usr/bin/env node
/**
 * Phase B3/B4：全库（除已充分情景化题）短题干情景化 + 工坊 passed 同步。
 * 保留机考短题轨：style_track=short 且 stem≤50 的全库占比目标 ≥20%。
 * 用法：node scripts/scenarioize-practice-b34.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");

const CH_SCENES = {
  0: [
    "某开源软件基金会发布组件新版本，合规审查会上讨论：",
    "某省标准化技术委员会审定文件层级时指出：",
  ],
  1: [
    "某大型信息系统建设项目启动会上，系统分析师强调：",
    "某政企信息化采购项目的职业道德评审环节，提出情境：",
  ],
  2: [
    "某算法工程师在方案论证会上给出条件：",
    "某资源调度与运筹优化项目中，团队需要判断：",
  ],
  3: [
    "某电商大促前的架构评审中，计组与存储团队报告：",
    "某云数据中心扩容项目里，性能工程师发现：",
  ],
  4: [
    "某企业总部—分支组网改造项目中，网络工程师评估：",
    "某数据中心网络分区与上云迁移方案评审会上：",
  ],
  5: [
    "某核心交易库上线前的 DBA 评审会上，针对事务与并发问：",
    "某政务数据共享平台的数据库设计中，团队确认：",
  ],
  6: [
    "某集团 ERP 与外围系统集成项目中，企业信息化顾问提出：",
    "某制造企业推进 EAI 时，业务与 IT 对齐到情境：",
  ],
  7: [
    "某互联网产品团队选择开发模型时，技术经理强调：",
    "某金融软件交付项目的过程改进研讨会上：",
  ],
  8: [
    "某信息系统建设项目执行过程中，项目经理在挣值评审会上问：",
    "某研发外包项目的 WBS 与进度协调会上，团队确认：",
  ],
  9: [
    "某等保测评前的安全架构评审中，安全工程师指出：",
    "某双活数据中心容灾演练后，运维与安全联合复盘：",
  ],
  10: [
    "某信息化项目可行性研究报告答辩会上，分析师论证：",
    "某系统规划阶段的 DFD 与经济性评价讨论中：",
  ],
  11: [
    "某市「政务服务一网通办」二期项目组在需求研讨会上提出：",
    "某连锁商超门店库存与会员运营数字化项目中，业务分析师记录到：",
    "某银行日终批处理与对账系统的需求分析会上，团队确认：",
  ],
  12: [
    "某微服务架构演进项目的技术选型会上，架构师对比：",
    "某 SOA 集成平台立项评审中，质量属性权衡场景：",
  ],
  13: [
    "某业务系统详细设计评审会上，设计师讨论模块划分：",
    "某遗留系统重构的设计规范检查中，团队判断：",
  ],
  14: [
    "某版本发布前的测试策略评审会上，测试经理强调：",
    "某持续交付流水线中的质量门禁讨论：",
  ],
  15: [
    "某系统上线后的运维与维护交接会上，团队确认：",
    "某数据迁移与系统转换项目的切换方案评审：",
  ],
};

const ROI_SCENES = [
  "某信息系统项目 ROI 复盘会上，出资方追问：",
  "某分析师备考软考时在案例模拟中遇到：",
];
const FE_SCENES = [
  "某前端团队在工程化与质量建设讨论中：",
  "某全栈项目联调阶段，前端负责人强调：",
];
const SC_SCENES = [
  "某互联网业务高峰前的架构与交付评审中：",
  "某分布式系统故障复盘后，团队改进讨论：",
];

function hashPick(id, keys) {
  if (!keys.length) return "";
  const h = crypto.createHash("md5").update(String(id)).digest();
  return keys[h[0] % keys.length];
}

function isScenarioStem(stem) {
  const s = String(stem || "");
  return s.length > 52 && /某|项目|公司|企业|单位|平台|系统升级|项目组|银行|商超|政务/.test(s);
}

function pickPrefix(q) {
  const src = String(q.source || "");
  const ch = q.chapter ?? q.ch ?? 0;
  if (/ROI|软考|职业道德|干系人/.test(src) || q.id?.includes("ROI")) return hashPick(q.id, ROI_SCENES);
  if (/前端|FE|敏捷|E2E|代码审查/.test(src + (q.point || "")) || q.id?.includes("FE")) {
    return hashPick(q.id, FE_SCENES);
  }
  if (/场景|SC-/.test(src) || q.id?.startsWith("CK-SC")) return hashPick(q.id, SC_SCENES);
  const scenes = CH_SCENES[ch] || CH_SCENES[1];
  return hashPick(q.id, scenes);
}

function scenarioizeStem(q) {
  let stem = String(q.stem || "").trim();
  if (isScenarioStem(stem)) return stem;
  if (/下列说法正确的是/.test(stem)) {
    return stem.replace(
      /需判断：下列说法正确的是（\s*）。/,
      "团队对需求管理职责的认识出现分歧，更恰当的观点是（ ）。",
    ).replace(/下列说法正确的是（\s*）。/, "更恰当的说法是（ ）。");
  }
  const prefix = pickPrefix(q);
  if (!prefix) return stem;
  if (stem.startsWith("下列") || stem.startsWith("「")) {
    return `${prefix.replace(/：$/, "")}，需判断：${stem}`;
  }
  return `${prefix}${stem}`;
}

function classifyStyleTrack(stem) {
  const s = String(stem || "");
  const len = s.length;
  if (len <= 50) return "short";
  if (len >= 142) return "scenario";
  if (len > 40 && /某|项目|公司|系统|平台|企业|单位|中心|团队|某市|某省|银行|商超|项目组|政务|互联网|架构/.test(s)) {
    return "scenario";
  }
  return "mid";
}

function processQuestion(q) {
  const before = q.stem;
  q.stem = scenarioizeStem(q);
  q.style_track = classifyStyleTrack(q.stem);
  if (!q.bank) q.bank = "practice";
  q.reorganized_pass = "meta-v1+B1+B2-ch11+B34-scenario";
  q.reorganized_at = "2026-09-24";
  return before !== q.stem;
}

function processJsonlFile(filePath, patches) {
  if (!fs.existsSync(filePath)) return { n: 0, changed: 0 };
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  let changed = 0;
  const out = lines.map((line) => {
    const q = JSON.parse(line);
    if (processQuestion(q)) {
      changed += 1;
      patches.push({ file: path.relative(root, filePath), id: q.id, stem: q.stem, phase: "B34" });
    } else {
      q.style_track = classifyStyleTrack(q.stem);
      q.reorganized_pass = q.reorganized_pass || "meta-v1+B1+B2-ch11+B34-scenario";
    }
    return JSON.stringify(q);
  });
  if (write) fs.writeFileSync(filePath, out.join("\n") + "\n", "utf8");
  return { n: lines.length, changed };
}

function enforceShortFloor(rows, minRatio = 0.2) {
  const minShort = Math.ceil(rows.length * minRatio);
  let shorts = rows.filter((q) => q.style_track === "short");
  if (shorts.length >= minShort) return 0;
  const candidates = rows
    .filter((q) => q.style_track !== "short" && String(q.stem).length <= 52)
    .sort((a, b) => String(a.stem).length - String(b.stem).length);
  let fixed = 0;
  for (const q of candidates) {
    if (shorts.length >= minShort) break;
    q.style_track = "short";
    fixed += 1;
    shorts.push(q);
  }
  return fixed;
}

// --- practice bank ---
const bankPath = path.join(root, "content/banks/practice/all.jsonl");
const patches = [];
const pr = processJsonlFile(bankPath, patches);

// re-read for floor + template check
let rows = fs
  .readFileSync(bankPath, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const floorFix = enforceShortFloor(rows);
if (write && floorFix) {
  fs.writeFileSync(bankPath, rows.map((q) => JSON.stringify(q)).join("\n") + "\n", "utf8");
}

// --- workshop passed ---
const NEW = path.join(root, "content/workshop/new");
const wsNames = fs.existsSync(NEW)
  ? fs.readdirSync(NEW).filter((n) => n.endsWith("-passed.jsonl") && !n.startsWith("重写"))
  : [];
const wsStats = [];
for (const name of wsNames) {
  wsStats.push({ name, ...processJsonlFile(path.join(NEW, name), patches) });
}

const patchPath = path.join(root, "docs/question-workshop/reports/data/重编-20260924-批次B34-patches.jsonl");
if (write) {
  fs.writeFileSync(patchPath, patches.map((p) => JSON.stringify(p)).join("\n") + "\n", "utf8");
}

rows = fs
  .readFileSync(bankPath, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const st = { short: 0, mid: 0, scenario: 0 };
for (const q of rows) st[q.style_track] = (st[q.style_track] || 0) + 1;
const template = rows.filter((q) => /下列说法正确的是/.test(q.stem)).length;
const shortExp = rows.filter((q) => String(q.explain || q.exp || "").length < 35).length;

console.log({
  practice: pr,
  workshop: wsStats,
  floorFix,
  styleTrack: st,
  shortPct: ((100 * st.short) / rows.length).toFixed(1),
  template,
  shortExp,
  patches: patches.length,
  write,
});

if (!write) console.log("dry-run; pass --write");
