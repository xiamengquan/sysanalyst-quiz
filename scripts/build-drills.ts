/**
 * 构建期：运用演练卡组（content/drills/*.md）→ public/data/drills.json
 * 每步四件套：范例（可抄上卷）/ 作用一句话 / 差异辨析 / 易错点；
 * 「溯源」路径经 resolveKbRef 解析为站内 /kb/{id}/ 深链。
 * 用法：npm run build:drills
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flattenKbIndex, resolveKbRef, type KbFlatItem } from "../src/lib/kb-resolve";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "content/drills");
const INDEX = path.join(ROOT, "public/data/kb-index.json");
const OUT = path.join(ROOT, "public/data/drills.json");

type DrillStep = {
  idx: number;
  name: string;
  ask: string;
  key: string;
  model: string;
  role: string;
  diff: string;
  trap: string;
  story?: string;
  src?: { href: string; label: string };
};

type DrillDeck = {
  id: string;
  title: string;
  domain: string;
  scene: string;
  story?: string;
  steps: DrillStep[];
};

const FIELD_RE = /^- \*\*(问|要点|范例|作用|辨析|易错|故事|溯源)\*\*：(.*)$/;

function parseDeck(md: string, fileStem: string, items: KbFlatItem[]): DrillDeck | null {
  const titleM = md.match(/^# 演练 · (.+)$/m);
  if (!titleM) return null;
  const domainM = md.match(/^> \*\*域\*\*：(.+)$/m);
  const sceneM = md.match(/^> \*\*情境\*\*：([\s\S]+?)$/m);
  const storyM = md.match(/^> \*\*故事线\*\*：(.+)$/m);

  const steps: DrillStep[] = [];
  const stepBlocks = md.split(/^## /m).slice(1);
  for (const block of stepBlocks) {
    const headM = block.match(/^(\d+)\s*[·•]\s*(.+)$/m);
    if (!headM) continue;
    const fields: Record<string, string> = {};
    for (const line of block.split("\n").slice(1)) {
      const m = line.match(FIELD_RE);
      if (m) fields[m[1]] = m[2].trim();
    }
    if (!fields["问"] || !fields["范例"]) continue;

    let src: DrillStep["src"];
    if (fields["溯源"]) {
      const ref = fields["溯源"].split("·")[0].trim().replace(/§.*$/, "").trim();
      const hit = resolveKbRef(items, ref);
      if (hit) src = { href: `/kb/${hit.id}/`, label: hit.title || ref };
      else src = { href: "/kb/", label: ref };
    }

    steps.push({
      idx: Number(headM[1]),
      name: headM[2].trim(),
      ask: fields["问"],
      key: fields["要点"] || "",
      model: fields["范例"],
      role: fields["作用"] || "",
      diff: fields["辨析"] || "",
      trap: fields["易错"] || "",
      story: fields["故事"] || undefined,
      src,
    });
  }
  if (!steps.length) return null;
  return {
    id: fileStem,
    title: titleM[1].trim(),
    domain: domainM?.[1]?.trim() || "综合",
    scene: sceneM?.[1]?.trim() || "",
    story: storyM?.[1]?.trim() || undefined,
    steps,
  };
}

function main() {
  const items = flattenKbIndex(JSON.parse(fs.readFileSync(INDEX, "utf8")).sections || []);
  const decks: DrillDeck[] = [];
  for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith(".md")).sort()) {
    const md = fs.readFileSync(path.join(SRC, f), "utf8");
    const deck = parseDeck(md, path.basename(f, ".md"), items);
    if (deck) decks.push(deck);
    else console.warn(`[build-drills] 跳过（无有效步骤）：${f}`);
  }
  const meta = {
    builtAt: new Date().toISOString(),
    decks: decks.length,
    steps: decks.reduce((n, d) => n + d.steps.length, 0),
  };
  fs.writeFileSync(OUT, JSON.stringify({ meta, decks }, null, 2) + "\n", "utf8");
  console.log({ drills: decks.length, steps: meta.steps, out: "public/data/drills.json" });
}

main();