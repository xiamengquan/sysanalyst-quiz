#!/usr/bin/env node
/**
 * 发版前静态检查：版本号对齐、release-notes、关键文件存在。
 * 用法：node scripts/check-release.mjs [--strict-out]
 *   --strict-out  要求已存在 out/（先 npm run build）
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const strictOut = process.argv.includes("--strict-out");
const errors = [];
const warns = [];

function readJson(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    errors.push(`缺少文件：${rel}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    errors.push(`JSON 无法解析：${rel} (${e.message})`);
    return null;
  }
}

function exists(rel, required = true) {
  const ok = fs.existsSync(path.join(root, rel));
  if (!ok && required) errors.push(`缺少：${rel}`);
  if (!ok && !required) warns.push(`可选缺失：${rel}`);
  return ok;
}

const pkg = readJson("package.json");
const notes = readJson("public/data/release-notes.json");
const pkgVer = pkg?.version;

if (pkgVer && notes) {
  if (notes.latest !== pkgVer) {
    errors.push(`release-notes.latest (${notes.latest}) ≠ package.json version (${pkgVer})`);
  }
  const head = Array.isArray(notes.releases) ? notes.releases[0] : null;
  if (!head) {
    errors.push("release-notes.releases 为空");
  } else if (head.version !== notes.latest) {
    errors.push(`releases[0].version (${head.version}) ≠ latest (${notes.latest})`);
  }
  if (head && (!Array.isArray(head.highlights) || head.highlights.length === 0)) {
    warns.push("releases[0].highlights 为空，更新弹窗将无要点");
  }
}

for (const id of ["kp-requirements-engineering", "kp-software-lifecycle", "kp-3-1", "kp-10-1"]) {
  const md = path.join(root, "public/data/kb-md", `${id}.md`);
  if (!fs.existsSync(md) || fs.statSync(md).size < 200) {
    errors.push(`缺少或过小：public/data/kb-md/${id}.md（请 npm run sync:kb）`);
  }
  const html = path.join(root, "public/data/kb-html", `${id}.html`);
  if (!fs.existsSync(html) || fs.statSync(html).size < 200) {
    errors.push(`缺少或过小：public/data/kb-html/${id}.html（请 npm run sync:kb）`);
  }
}

for (const rel of [
  "public/data/questions.json",
  "public/data/cases.json",
  "public/data/kb-index.json",
  "public/data/kb-search-index.json",
  "public/data/sitemap-urls.json",
  "src/app/sitemap.ts",
  "src/app/robots.ts",
  "next.config.ts",
  ".env.example",
  "docs/web-team/发布/静态托管发布清单.md",
]) {
  exists(rel, true);
}

const sitemapTs = path.join(root, "src/app/sitemap.ts");
if (fs.existsSync(sitemapTs)) {
  const src = fs.readFileSync(sitemapTs, "utf8");
  if (!src.includes('export const dynamic = "force-static"')) {
    errors.push("src/app/sitemap.ts 须 export const dynamic = \"force-static\"（静态 export sitemap）");
  }
  if (!/export default function sitemap\(\)/.test(src)) {
    errors.push("src/app/sitemap.ts 须 default export sitemap() → MetadataRoute.Sitemap");
  }
}

exists("docs/web-team/发布/版本说明-v" + (pkgVer || "?.?.?") + ".md", false);

if (strictOut) {
  if (!exists("out/index.html", true)) {
    /* already recorded */
  } else {
    const about = path.join(root, "out/about/index.html");
    if (!fs.existsSync(about)) warns.push("out/about/index.html 不存在（trailingSlash 导出异常？）");
    const outSm = path.join(root, "out/sitemap.xml");
    const outRobots = path.join(root, "out/robots.txt");
    if (!fs.existsSync(outSm)) {
      errors.push("out/sitemap.xml 不存在（Next app/sitemap.ts 未产出，检查 build）");
    } else if (fs.statSync(outSm).size < 1000) {
      errors.push("out/sitemap.xml 过小，内容可能不完整");
    }
    if (!fs.existsSync(outRobots)) {
      errors.push("out/robots.txt 不存在（Next app/robots.ts 未产出）");
    }
    const smCheck = spawnSync("node", ["scripts/check-sitemap.mjs", "--strict-out"], {
      cwd: root,
      encoding: "utf8",
    });
    if (smCheck.status !== 0) {
      errors.push("check-sitemap --strict-out 未通过");
      if (smCheck.stderr) console.error(smCheck.stderr);
      if (smCheck.stdout) console.error(smCheck.stdout);
    }
  }
} else if (!fs.existsSync(path.join(root, "out"))) {
  warns.push("尚无 out/：正式上传前请 npm run build，再用 --strict-out 复查");
}

const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
if (!envExample.includes("NEXT_PUBLIC_SUPABASE_URL")) {
  errors.push(".env.example 缺少 NEXT_PUBLIC_SUPABASE_URL 说明");
}
if (!envExample.includes("NEXT_PUBLIC_SITE_URL")) {
  errors.push(".env.example 缺少 NEXT_PUBLIC_SITE_URL 说明");
}

console.log(`check-release · package ${pkgVer || "?"} · latest ${notes?.latest || "?"}`);
for (const w of warns) console.warn("  warn:", w);
for (const e of errors) console.error("  error:", e);

const reorg = spawnSync("node", ["scripts/validate-reorg.mjs"], { cwd: root, encoding: "utf8" });
if (reorg.status !== 0) {
  errors.push("validate-reorg 未通过");
  if (reorg.stderr) console.error(reorg.stderr);
  if (reorg.stdout) console.error(reorg.stdout);
}

if (errors.length) {
  process.exit(1);
}
console.log("  ok");
