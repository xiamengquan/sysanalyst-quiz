#!/usr/bin/env node
/**
 * 线上 SEO 冒烟（默认 maintruly.top）：sitemap/robots 须 200 且为 XML/纯文本。
 * 用法：node scripts/check-live-seo.mjs [baseUrl]
 */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_SITE_URL || "https://maintruly.top")
  .replace(/\/+$/, "");

const checks = [
  { path: "/sitemap.xml", expectType: "application/xml", minBytes: 1000 },
  { path: "/robots.txt", expectType: "text/plain", minBytes: 50 },
];

const errors = [];

async function run() {
for (const { path, expectType, minBytes } of checks) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ct = (res.headers.get("content-type") || "").split(";")[0].trim();
    const buf = await res.arrayBuffer();
    if (res.status !== 200) errors.push(`${url} → HTTP ${res.status}`);
    else if (!ct.includes(expectType.split("/")[1])) {
      errors.push(`${url} → content-type ${ct} (expected ${expectType})`);
    } else if (buf.byteLength < minBytes) {
      errors.push(`${url} → body too small (${buf.byteLength} bytes)`);
    }
  } catch (e) {
    errors.push(`${url} → ${e.message}`);
  }
}

// trailingSlash 站点易误测：带尾斜杠的 SEO 文件应 301/200，不应 404 HTML
for (const path of ["/sitemap.xml/", "/robots.txt/"]) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (res.status === 404) {
      errors.push(`${url} → 404（审计工具若带尾斜杠会误判 sitemap 不可用；应 301 到无斜杠路径）`);
    }
  } catch (e) {
    errors.push(`${url} → ${e.message}`);
  }
}

if (errors.length) {
  console.error("check-live-seo failed:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`check-live-seo ok · ${base}`);
}

run();
