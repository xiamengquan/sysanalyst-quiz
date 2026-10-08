/**
 * 构建期：Markdown → HTML 片段，写入 public/data/kb-html/{id}.html
 * 与客户端 renderKbMarkdown 同源，避免运行时 marked 解析。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flattenKbIndex } from "../src/lib/kb-resolve";
import { renderKbMarkdown } from "../src/lib/kb-md";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INDEX = path.join(ROOT, "public/data/kb-index.json");
const KB_DIR = path.join(ROOT, "public/kb");
const OUT = path.join(ROOT, "public/data/kb-html");

function main() {
  const catalog = JSON.parse(fs.readFileSync(INDEX, "utf8"));
  const items = flattenKbIndex(catalog.sections || []);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  let n = 0;
  let missing = 0;
  for (const item of items) {
    if (!item.id || !item.path) continue;
    const fp = path.join(KB_DIR, item.path);
    if (!fs.existsSync(fp)) {
      missing += 1;
      continue;
    }
    const md = fs.readFileSync(fp, "utf8");
    const html = renderKbMarkdown(md, items, item.id);
    fs.writeFileSync(path.join(OUT, `${item.id}.html`), html, "utf8");
    n += 1;
  }

  const meta = {
    builtAt: new Date().toISOString(),
    docs: n,
    missing,
  };
  fs.writeFileSync(path.join(OUT, "_meta.json"), JSON.stringify(meta), "utf8");
  console.log({ kbHtml: n, missing, out: "public/data/kb-html/" });
}

main();
