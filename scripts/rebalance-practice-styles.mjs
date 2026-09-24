#!/usr/bin/env node
/**
 * 重编后 style_track 再平衡：机考 short ≥20%，scenario 约 35–45%，其余 mid。
 * 对保留 short 轨的题使用去前缀后的短题干（若仍 >50 字则保留最短原文）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bankPath = path.join(root, "content/banks/practice/all.jsonl");
const write = process.argv.includes("--write");

const PREFIXES = [
  "某开源软件基金会发布组件新版本，合规审查会上讨论：",
  "某省标准化技术委员会审定文件层级时指出：",
  "某大型信息系统建设项目启动会上，系统分析师强调：",
  "某政企信息化采购项目的职业道德评审环节，提出情境：",
  "某算法工程师在方案论证会上给出条件：",
  "某资源调度与运筹优化项目中，团队需要判断：",
  "某电商大促前的架构评审中，计组与存储团队报告：",
  "某云数据中心扩容项目里，性能工程师发现：",
  "某企业总部—分支组网改造项目中，网络工程师评估：",
  "某数据中心网络分区与上云迁移方案评审会上：",
  "某核心交易库上线前的 DBA 评审会上，针对事务与并发问：",
  "某政务数据共享平台的数据库设计中，团队确认：",
  "某集团 ERP 与外围系统集成项目中，企业信息化顾问提出：",
  "某制造企业推进 EAI 时，业务与 IT 对齐到情境：",
  "某互联网产品团队选择开发模型时，技术经理强调：",
  "某金融软件交付项目的过程改进研讨会上：",
  "某信息系统建设项目执行过程中，项目经理在挣值评审会上问：",
  "某研发外包项目的 WBS 与进度协调会上，团队确认：",
  "某等保测评前的安全架构评审中，安全工程师指出：",
  "某双活数据中心容灾演练后，运维与安全联合复盘：",
  "某信息化项目可行性研究报告答辩会上，分析师论证：",
  "某系统规划阶段的 DFD 与经济性评价讨论中：",
  "某市「政务服务一网通办」二期项目组在需求研讨会上提出：",
  "某连锁商超门店库存与会员运营数字化项目中，业务分析师记录到：",
  "某银行日终批处理与对账系统的需求分析会上，团队确认：",
  "某微服务架构演进项目的技术选型会上，架构师对比：",
  "某 SOA 集成平台立项评审中，质量属性权衡场景：",
  "某业务系统详细设计评审会上，设计师讨论模块划分：",
  "某遗留系统重构的设计规范检查中，团队判断：",
  "某版本发布前的测试策略评审会上，测试经理强调：",
  "某持续交付流水线中的质量门禁讨论：",
  "某系统上线后的运维与维护交接会上，团队确认：",
  "某数据迁移与系统转换项目的切换方案评审：",
  "某信息系统项目 ROI 复盘会上，出资方追问：",
  "某分析师备考软考时在案例模拟中遇到：",
  "某前端团队在工程化与质量建设讨论中：",
  "某全栈项目联调阶段，前端负责人强调：",
  "某互联网业务高峰前的架构与交付评审中：",
  "某分布式系统故障复盘后，团队改进讨论：",
  "上述系统的结构化分析工作坊中，分析师核对数据流图时问：",
  "同一项目的用例建模评审会上，产品经理强调：",
  "需求基线发布之后，变更控制委员会评估一项范围变更时指出：",
  "测试负责人对照 SRS 做需求确认与验证时，需要判断：",
  "需求获取阶段，分析师选择调研方法时面临情境：",
].sort((a, b) => b.length - a.length);

function stripPrefix(stem) {
  let s = String(stem || "");
  for (const p of PREFIXES) {
    if (s.startsWith(p)) {
      s = s.slice(p.length);
      break;
    }
  }
  s = s.replace(/^[^，]+，需判断：/, "");
  return s.trim();
}

function classifyByLen(stem) {
  const len = stem.length;
  if (len <= 50) return "short";
  if (len >= 142) return "scenario";
  if (len > 40 && /某|项目|公司|系统|平台|企业|单位|银行|商超|政务|互联网|架构/.test(stem)) return "scenario";
  return "mid";
}

const rows = fs.readFileSync(bankPath, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const n = rows.length;
const minShort = Math.ceil(n * 0.2);
const targetScenario = Math.round(n * 0.4);

const enriched = rows.map((q) => {
  const stripped = stripPrefix(q.stem);
  return {
    q,
    stripped,
    strippedLen: stripped.length,
    fullLen: q.stem.length,
    score: stripped.length + (q.difficulty === "basic" ? -5 : 0),
  };
});

enriched.sort((a, b) => a.score - b.score);
const shortSet = new Set(enriched.slice(0, minShort).map((x) => x.q.id));

for (const { q, stripped } of enriched) {
  if (shortSet.has(q.id)) {
    q.stem = stripped;
    q.style_track = "short";
  } else {
    q.style_track = classifyByLen(q.stem);
  }
}

// boost scenario count toward target without breaking short
let scen = rows.filter((q) => q.style_track === "scenario").length;
const candidates = rows
  .filter((q) => !shortSet.has(q.id) && q.style_track === "mid" && q.stem.length >= 55)
  .sort((a, b) => b.stem.length - a.stem.length);
for (const q of candidates) {
  if (scen >= targetScenario) break;
  q.style_track = "scenario";
  scen += 1;
}

const st = { short: 0, mid: 0, scenario: 0 };
for (const q of rows) st[q.style_track] = (st[q.style_track] || 0) + 1;

console.log({ n, minShort, targetScenario, styleTrack: st, template: rows.filter((q) => /下列说法正确的是/.test(q.stem)).length });

if (write) {
  fs.writeFileSync(bankPath, rows.map((q) => JSON.stringify(q)).join("\n") + "\n", "utf8");
  console.log("written", bankPath);
} else {
  console.log("dry-run; pass --write");
}
