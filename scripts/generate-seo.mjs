#!/usr/bin/env node
/**
 * 写入 public/data/sitemap-urls.json；Next app/sitemap.ts 在 build 时读取并生成 /sitemap.xml。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSitemapUrls } from "./seo-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const urls = buildSitemapUrls(root);
const payload = {
  generatedAt: new Date().toISOString(),
  urls: urls.map((u) => ({
    url: u.loc,
    lastModified: u.lastmod ? u.lastmod.toISOString() : undefined,
    changeFrequency: u.changefreq,
    priority: u.priority,
  })),
};
const out = path.join(root, "public/data/sitemap-urls.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log({ generateSeo: true, urls: payload.urls.length, out: "public/data/sitemap-urls.json" });
