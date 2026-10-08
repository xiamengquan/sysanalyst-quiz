#!/usr/bin/env node
/** 写入 public/sitemap.xml 与 public/robots.txt（保留 URL 顺序，避免 Next 按字串重排） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSitemapUrls, renderRobotsTxt, renderSitemapXml } from "./seo-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const urls = buildSitemapUrls(root);
const xml = renderSitemapXml(urls);
const robots = renderRobotsTxt(root);

fs.writeFileSync(path.join(root, "public/sitemap.xml"), xml, "utf8");
fs.writeFileSync(path.join(root, "public/robots.txt"), robots, "utf8");
console.log({ generateSeo: true, urls: urls.length });
