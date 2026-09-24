#!/usr/bin/env node
/**
 * 非真题（practice/all.jsonl）元数据重编重组：style_track / intensity / bank 对齐真题规律。
 * 不修改题干与选项正文（内容重编走工坊批次 + 出题者 Agent）。
 * 用法：node scripts/reorganize-practice-bank.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bankPath = path.join(root, "content/banks/practice/all.jsonl");
const auditPath = path.join(root, "content/banks/practice/reorg-audit-2026-09-24.json");
const write = process.argv.includes("--write");

const BOOST_CH = new Set([3, 4, 5, 7, 9, 10, 11, 12, 14]);
const STABLE_CH = new Set([0, 1, 2, 6, 8, 13, 15]);

function classifyStyleTrack(stem) {
  const s = String(stem || "");
  const len = s.length;
  if (len <= 50) return "short";
  if (len >= 142) return "scenario";
  if (len > 40 && /某|项目|公司|系统|平台|企业|单位|中心|团队|某市|某省/.test(s)) return "scenario";
  return "mid";
}

function classifyIntensity(ch, point, source) {
  if (source?.includes("ROI加练") || source?.includes("加练")) return "boost";
  if (BOOST_CH.has(ch)) return "boost";
  if (STABLE_CH.has(ch)) return "stable";
  return "boost";
}

function inferDifficulty(stem, prev) {
  const s = String(stem || "");
  if (/计算|求|公式|SPI|CPI|掩码|子网|概率|期望|复杂度/.test(s)) return "deep";
  if (/对比|区别|相比|不同于|优缺点|架构|权衡/.test(s) && s.length > 60) return "deep";
  if (s.length <= 45 && !/对比|计算/.test(s)) return "basic";
  return prev === "real" ? "medium" : prev || "medium";
}

function normalizeSourceBank(source) {
  const src = String(source || "自编练习");
  if (src.includes("工坊") || src.includes("问答")) return { source: src, bank: "practice" };
  return { source: src, bank: "practice" };
}

const lines = fs.readFileSync(bankPath, "utf8").split(/\r?\n/).filter(Boolean);
const audit = { updatedAt: "2026-09-24", total: lines.length, styleTrackChanges: 0, needsExplainRewrite: [], templateStems: [], byStyle: {} };

const out = lines.map((line) => {
  const q = JSON.parse(line);
  const ch = q.chapter ?? q.ch ?? 0;
  const oldStyle = q.style_track;
  const newStyle = classifyStyleTrack(q.stem);
  if (oldStyle !== newStyle) audit.styleTrackChanges += 1;

  const exp = String(q.explain || q.exp || "");
  if (exp.length < 35) audit.needsExplainRewrite.push({ id: q.id, len: exp.length, point: q.point });

  if (/下列说法正确的是/.test(q.stem || "")) audit.templateStems.push(q.id);

  const { source, bank } = normalizeSourceBank(q.source);
  audit.byStyle[newStyle] = (audit.byStyle[newStyle] || 0) + 1;

  return {
    ...q,
    chapter: ch,
    ch,
    bank,
    source,
    style_track: newStyle,
    intensity: q.intensity || classifyIntensity(ch, q.point, source),
    difficulty: q.difficulty || inferDifficulty(q.stem, q.difficulty),
    reorganized_at: "2026-09-24",
    reorganized_pass: "meta-v1",
  };
});

audit.needsExplainRewrite = audit.needsExplainRewrite.slice(0, 500);

if (write) {
  fs.writeFileSync(bankPath, out.map((o) => JSON.stringify(o)).join("\n") + "\n", "utf8");
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2), "utf8");
  console.log("written", bankPath);
  console.log("audit", auditPath);
} else {
  console.log("dry-run", audit);
  console.log("pass --write to apply");
}
