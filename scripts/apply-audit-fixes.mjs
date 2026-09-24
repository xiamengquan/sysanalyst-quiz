#!/usr/bin/env node
/** 机审 18 题驳回项一次性修复（§5.3 / §9.10 / §4 / §6） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bankPath = path.join(root, "content/banks/practice/all.jsonl");
const write = process.argv.includes("--write");

/** @type {Record<string, Partial<{stem:string, point:string, difficulty:string, options:Record<string,string>}>>} */
const FIX = {
  "CK-ROI-6136bf930d": { options: { D: "等于所有非关键路径活动的时差之和" } },
  "CK-ROI-119c9aa201": {
    stem: "某信息化项目可行性研究阶段，分析师说明结构化分析更强调（ ）。",
  },
  "CK-ROI-6dc98ee672": { options: { C: "仅属于项目章程中的高层愿景表述" } },
  "CK-ROI-867695b3ef": { options: { D: "只要求满足第一范式（属性原子性）" } },
  "CK-ROI-dca80242a6": { options: { D: "属于部署视图中节点物理摆放" } },
  "CK-11-e71544306d": { options: { C: "期望需求（用户默认应有但未明说）" } },
  "CK-11-2d74af413b": { options: { C: "仅归入「+」中的授权许可因素" } },
  "CK-11-cbd6ff8c30": { options: { D: "R 可靠性（平均无故障时间）" } },
  "CK-11-7f81786eeb": { options: { D: "仅属于项目会计科目分类" } },
  "CK-11-73d14df94a": { options: { C: "仅属于配置库中的基线标签管理" } },
  "CK-11-ebe037bfbe": {
    point: "SRS定位",
    options: {
      A: "软件需求规格说明（SRS），约定对外可验证的需求契约",
    },
  },
  "CK-11-6ee189d351": {
    point: "用例定义",
    options: { A: "用例（Use Case）" },
  },
  "CK-FE-bc91c3f878": { point: "单元测试·纯函数" },
  "CK-11-SAO-4404654736": {
    difficulty: "medium",
    stem: "某 App 需求评审中，题干强调「角色、用例名、边界/控制/实体、消息顺序」，建模时更优先采用（ ）。",
  },
};

const lines = fs.readFileSync(bankPath, "utf8").split(/\r?\n/).filter(Boolean);
let n = 0;
const out = lines.map((line) => {
  const q = JSON.parse(line);
  const f = FIX[q.id];
  if (!f) return line;
  n += 1;
  if (f.stem) q.stem = f.stem;
  if (f.point) q.point = f.point;
  if (f.difficulty) q.difficulty = f.difficulty;
  if (f.options) q.options = { ...q.options, ...f.options };
  return JSON.stringify(q);
});

console.log({ patched: n, write });
if (write) fs.writeFileSync(bankPath, out.join("\n") + "\n", "utf8");
