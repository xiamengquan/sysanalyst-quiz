#!/usr/bin/env node
/**
 * 从《四层七日背诵总册》必会默写卡（M）与《记忆强化卡组》硬记忆点（56 条）
 * 程序化提取闪卡库 → public/data/flashcards.json
 * 用法：npm run build:flashcards
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zc = path.join(root, "content/kb/速查/四层七日背诵总册.md");
const deck = path.join(root, "content/kb/速查/记忆强化-间隔重复与硬记忆点卡组.md");
const out = path.join(root, "public/data/flashcards.json");

/** 卡组专题 → 总册日次（对齐 kb-seven-day 章节映射） */
const TOPIC_DAY = {
  T01: "d6", T02: "d6", T03: "d4", T04: "d7", T05: "d1", T06: "d5",
  T07: "d5", T08: "d2", T09: "d2", T10: "d3", T11: "d6", T12: "d4",
  T13: "d6", T14: "d7", T15: null, T16: "d3", T17: "d7", T18: "d7",
};

/** 兜底问句人工覆盖（key = 卡 id；用于无冒号且无数字的陈述式硬记忆点） */
const FRONT_OVERRIDES = {
  "fc-k-t01-05": "总线带宽如何计算？",
  "fc-k-t03-04": "增量备份和差异备份各基于哪次备份？",
  "fc-k-t03-07": "安全审计与标识鉴别，哪个发生在事前、哪个在事后？",
  "fc-k-t07-01": "BLP 与 Biba 各允许怎么读、怎么写？分别保护什么属性？",
  "fc-k-t07-06": "N 版本与恢复块，谁是前向恢复、谁是后向恢复？",
  "fc-k-t07-07": "口令认证的弱点是什么？动态口令的特点？",
  "fc-k-t09-02": "需求获取五法的选型口诀？各适用什么场景？",
  "fc-k-t09-03": "DFD 父子图「平衡」指什么？",
  "fc-k-t09-04": "include 与 extend 的区别？",
  "fc-k-t10-03": "质量属性六元组是什么？ATAM 的敏感点与权衡点？",
  "fc-k-t11-01": "耦合从低到高七级？内聚从高到低七级？各哪种最优？",
  "fc-k-t11-02": "SOLID 是哪五个原则？ECB 是哪三层？",
  "fc-k-t12-02": "冒烟测试与回归测试的区别？",
  "fc-k-t13-01": "MTBF、MTTF、MTTR 的关系公式？",
};

function maskBlanks(text) {
  return text.replace(/[0-9０-９]+(?:\.[0-9]+)?/g, "____").replace(/[%％]/g, "");
}

function mFront(term) {
  const t = term.trim();
  if (/口诀$/.test(t)) return `${t}是什么？请完整展开`;
  if (/(强弱|对比|区别|辨析)$/.test(t)) return `${t}？请排序或辨析`;
  return `${t}？（默写要点）`;
}

const cards = [];

// ---------- 1. 总册 · 必会默写卡（M） ----------
const zcText = fs.readFileSync(zc, "utf8");
const dayBlocks = zcText.split(/^## (D[1-7]) · /m).slice(1); // [D1, body, D2, body...]
let mCount = 0;
for (let i = 0; i < dayBlocks.length; i += 2) {
  const day = dayBlocks[i].toLowerCase();
  const body = dayBlocks[i + 1];
  const mBlock = body.split(/^### 必会 · 默写卡（M）\s*$/m)[1];
  if (!mBlock) continue;
  const items = mBlock.split(/^### /m)[0].match(/^\d+\.\s+\*\*(.+?)\*\*[：:](.+)$/gm) || [];
  items.forEach((line) => {
    const m = line.match(/^\d+\.\s+\*\*(.+?)\*\*[：:](.+)$/);
    if (!m) return;
    mCount += 1;
    const backText = m[2].trim().replace(/[★＋]+/g, "").replace(/\*\*/g, "").replace(/。$/, "").trim();
    cards.push({
      id: `fc-m-${day}-${String(mCount).padStart(3, "0")}`,
      day,
      tier: "M",
      hard: m[2].includes("★"),
      front: mFront(m[1]),
      back: backText,
      src: { href: `/kb/quick-four-tier-7d/#${day}`, label: `总册 ${day.toUpperCase()} · 必会卡` },
    });
  });
}

// ---------- 2. 记忆卡组 · 硬记忆点（K，56 条） ----------
const deckText = fs.readFileSync(deck, "utf8");
const deckSec = deckText.split(/^## 4\. 硬记忆点卡组.*$/m)[1].split(/^## 5\./m)[0];
const groups = deckSec.split(/^### (T\d+[^\n]*)$/m).slice(1);
let kCount = 0;
for (let g = 0; g < groups.length; g += 2) {
  const gTitle = groups[g];
  const topic = gTitle.slice(0, 3);
  const gBody = groups[g + 1];
  const rows = gBody.match(/^\d+\.\s+(.+)$/gm) || [];
  rows.forEach((line, ri) => {
    let text = line.replace(/^\d+\.\s+/, "").trim();
    const hard = text.includes("★");
    text = text.replace(/[★＋]+/g, "").replace(/\*\*/g, "").trim();
    if (!text) return;
    kCount += 1;
    const id = `fc-k-${topic.toLowerCase()}-${String(ri + 1).padStart(2, "0")}`;
    let front;
    if (text.includes("：") || text.includes(":")) {
      const idx = text.search(/[：:]/);
      front = `${text.slice(0, idx).trim()}？`;
    } else {
      const masked = maskBlanks(text);
      if (FRONT_OVERRIDES[id]) {
        front = FRONT_OVERRIDES[id];
      } else if (masked !== text) {
        front = `填空默写：${masked}`;
      } else {
        const gName = gTitle.replace(/[（(].*$/, "").replace(/[★＋]/g, "").trim();
        front = `默写硬记忆点（${gName}）第 ${ri + 1} 条`;
      }
    }
    cards.push({
      id,
      day: TOPIC_DAY[topic] || null,
      tier: "K",
      hard,
      front,
      back: text,
      src: { href: "/kb/quick-memory-plan/", label: `记忆卡组 · ${topic}` },
    });
  });
}

cards.sort((a, b) => a.id.localeCompare(b.id));
const payload = {
  meta: {
    builtAt: new Date().toISOString(),
    total: cards.length,
    m: cards.filter((c) => c.tier === "M").length,
    k: cards.filter((c) => c.tier === "K").length,
    hard: cards.filter((c) => c.hard).length,
    source: ["速查/四层七日背诵总册.md · 必会默写卡", "速查/记忆强化-间隔重复与硬记忆点卡组.md · §4"],
  },
  cards,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log({
  buildFlashcards: true,
  total: payload.meta.total,
  m: payload.meta.m,
  k: payload.meta.k,
  hard: payload.meta.hard,
  out: "public/data/flashcards.json",
});