# sitemap.xml & robots.txt 深度审计 v3.0 · 对照台账

> **审计日期**：2026-10-08  
> **站点版本**：v0.9.54  
> **生成源**：`scripts/generate-seo.mjs` → `public/data/sitemap-urls.json` · **`src/app/sitemap.ts`** · **`src/app/robots.ts`** → `out/sitemap.xml` · `out/robots.txt`

## 工单状态

| 工单 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| 13 排序与缺失条目 | P0 | ✅ v0.9.50 | api-ref 按 `kp-{n}` 字典序；`kp-13-1` 别名 → `kp-ops-metrics-mttr-mtbf-mttf-mtta` |
| 18 URL 可访问性 | P0 | ✅ v0.9.54 | `app/sitemap.ts` + `force-static` → `out/sitemap.xml`；`check:release --strict-out` 含 sitemap 门禁；线上 `/sitemap.xml` 200 |
| 14 英文 slug 全站替换 | P1 | ✅ v0.9.51 | **47** 条中文/混合 `kp-*` → 英文 canonical；旧 URL 静态页 + `KbCanonicalRedirect`；数字大纲 id（如 `kp-3-1`）未改 |
| 15 lastmod / priority | P1 | ✅ v0.9.50 | 文件 mtime + 发版日；教程章练习热力分档 priority/changefreq |
| 16 刷题页 sitemap | P1 | ✅ 说明 | 刷题为 **`/` 单页应用**（`/?bank=` 参数），无独立 `/exam/` 路由；sitemap 已收录 `/` priority 1.0 |
| 17 robots 完善 | P2 | ✅ v0.9.50 | Bing/Yandex `crawlDelay:1`；`Disallow: /*?*` 避免参数 URL 重复收录；保留 Host |

## 审计项纠偏

| 报告结论 | 实际 |
|----------|------|
| S-01 `kp-13-1` 缺失 | 大纲 **15.1** canonical **`kp-ops-metrics-mttr-mtbf-mttf-mtta`**；别名 **`/kb/kp-13-1/`** 及旧中文 slug 跳转 canonical |
| S-02 `kp-5-1` 排序靠后 | 因 api-ref JSON 按科目 1→3 写入；sitemap **生成时重排**，不再依赖索引文件顺序 |
| S-04 lastmod 全为 2026-09-26 | 已改为 **Markdown 文件 mtime**，静态页用 **release-notes 最新 date** |
| R-02 `/knowledge/` 无 301 | 静态托管为 **客户端 replace**（`LegacyKnowledgeRedirect`）；robots 仍 Disallow，sitemap 不含旧路径 |
| **第四轮 P0「sitemap 无法访问」** | **误报/路径误测**：`https://maintruly.top/sitemap.xml` 为 **200** · `application/xml` · 与仓库 `public/sitemap.xml` 一致（277 URL）。根因常是 **`/sitemap.xml/` 带尾斜杠 → 404**（`trailingSlash: true` 仅作用于页面路由，不作用于根目录静态文件）。v0.9.52 在 `edgeone.json` 增加 **301** 到无斜杠路径 |
| 第四轮「须 app/sitemap.ts」 | v0.9.54 **已采用 Next Metadata Route**：`app/sitemap.ts` 读 `sitemap-urls.json`；`app/robots.ts`；不再提交 `public/sitemap.xml` |
| release-notes「sitemap 仅英文 id」 | v0.9.53 已落实：**sitemap 仅 kb-index canonical**（229 URL）；别名仍静态页 + 跳转，不进 sitemap |

## 验收

```bash
npm run check:sitemap
npm run build && node scripts/check-sitemap.mjs --strict-out
node scripts/check-live-seo.mjs https://maintruly.top
```
