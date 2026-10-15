#!/usr/bin/env node
/**
 * build-audio-articles.mjs
 * 从《四层七日背诵总册》（合并版）解析四大方面 39 点「逐点讲透 · 一通到底」块，
 * 生成 public/data/audio-articles.json —— /audio「文章池」的朗读数据源。
 * 每点一段 TTS 友好文本：第N点，标题。第一性拆解：… 费曼讲法：… 一通到底：… 考场回扣：…
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content/kb/速查/四层七日背诵总册.md");
const OUT = path.join(ROOT, "public/data/audio-articles.json");

const DOMAIN = {
  req: { id: "article-req", title: "需求工程 · 10 点讲透（req-p01~p10）", group: "需求工程文章" },
  web: { id: "article-web", title: "Web 架构 · 10 点讲透（web-p01~p10）", group: "Web 文章" },
  mic: { id: "article-mic", title: "微服务 · 9 点讲透（mic-p01~p09）", group: "微服务文章" },
  db: { id: "article-db", title: "数据库 · 10 点讲透（db-p01~p10）", group: "数据库文章" },
};

const md = fs.readFileSync(SRC, "utf8");
const lines = md.split("\n");

/** 基础 markdown 清理（浏览器端 speakText 再做 TTS 口语化） */
const clean = (s) =>
  s
    .replace(/\*\*/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const docs = new Map(); // prefix -> { points: [] }
let curPrefix = null;
let curPoint = null;
let inSeg = false; // 是否在逐点讲透节内

for (const raw of lines) {
  const line = raw.trimEnd();

  // 章边界：进入四大方面章
  if (/^## D[234] ·/.test(line)) {
    inSeg = false;
    curPoint = null;
    continue;
  }
  if (/^## /.test(line)) {
    // 其他大章（D1/D5/D6/D7/使用法等）退出
    inSeg = false;
    curPoint = null;
    continue;
  }

  if (/^### 逐点讲透 · 一通到底/.test(line)) {
    inSeg = true;
    continue;
  }
  if (inSeg && /^### /.test(line)) {
    // 退出逐点节（K/S/D 节）；但 D3 的 Web 篇/微服务篇子标题保持
    if (!/^### (Web 篇|微服务篇)/.test(line)) {
      inSeg = false;
      curPoint = null;
      continue;
    }
  }

  // 逐点标题：#### 01 需求三层（req-p01）
  const m = line.match(/^#### (\d+) (.+?)（([a-z]+-p(\d+))）/);
  if (inSeg && m) {
    const [, no, title, pid] = m;
    curPrefix = pid.replace(/-p\d+$/, "");
    if (!docs.has(curPrefix)) docs.set(curPrefix, []);
    curPoint = { no: Number(no), pid, title: clean(title), segs: [] };
    docs.get(curPrefix).push(curPoint);
    continue;
  }

  // 四段 bullet：- **第一性拆解**：内容
  if (inSeg && curPoint) {
    const b = line.match(/^- \*\*(.+?)\*\*[：:]\s*(.*)$/);
    if (b) {
      curPoint.segs.push({ name: b[1], text: clean(b[2]) });
      continue;
    }
    // bullet 续行（同一 bullet 折行）
    if (curPoint.segs.length && line.startsWith("  ") && line.trim()) {
      curPoint.segs[curPoint.segs.length - 1].text += clean(line);
    }
  }
}

const out = { meta: { builtAt: new Date().toISOString() }, articles: [] };
let errors = [];
for (const [prefix, points] of docs) {
  const meta = DOMAIN[prefix];
  if (!meta) {
    errors.push(`未知域前缀 ${prefix}`);
    continue;
  }
  const paragraphs = points.map((p) => {
    if (!p.segs.length) errors.push(`${p.pid} 无段落内容`);
    const text = `第${p.no}点，${p.title}。` + p.segs.map((s) => `${s.name}：${s.text}。`).join("");
    return { id: `ar-${p.pid}`, no: p.no, pid: p.pid, title: p.title, text };
  });
  out.articles.push({
    id: meta.id,
    title: meta.title,
    group: meta.group,
    prefix,
    intro: `现在开始播放${meta.group.replace("文章", "")}知识点的逐点讲透。`,
    paragraphs,
  });
}
out.articles.sort((a, b) => a.prefix.localeCompare(b.prefix));

// 期望 39 点：req 10 + web 10 + mic 9 + db 10
const total = out.articles.reduce((n, a) => n + a.paragraphs.length, 0);
if (total !== 39) errors.push(`点数 ${total} ≠ 39`);
if (errors.length) {
  console.error("build-audio-articles 校验失败：");
  for (const e of errors) console.error(" - " + e);
  process.exit(1);
}

fs.writeFileSync(OUT, JSON.stringify(out), "utf8");
console.log(
  `build-audio-articles ok · articles ${out.articles.length} · points ${total} · ` +
    out.articles.map((a) => `${a.prefix}:${a.paragraphs.length}`).join(" ")
);