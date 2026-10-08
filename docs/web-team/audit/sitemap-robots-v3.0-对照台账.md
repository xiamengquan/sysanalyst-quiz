# sitemap.xml & robots.txt 深度审计 v3.0 · 对照台账

> **审计日期**：2026-10-08  
> **站点版本**：v0.9.51  
> **生成源**：`scripts/generate-seo.mjs` → `public/sitemap.xml` · `public/robots.txt`

## 工单状态

| 工单 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| 13 排序与缺失条目 | P0 | ✅ v0.9.50 | api-ref 按 `kp-{n}` 字典序；`kp-13-1` 别名 → `kp-ops-metrics-mttr-mtbf-mttf-mtta` |
| 18 URL 可访问性 | P0 | ✅ v0.9.50 | `check-sitemap.mjs`（索引文件存在；`--strict-out` 校验 out/sitemap.xml） |
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

## 验收

```bash
npm run check:sitemap
npm run build && node scripts/check-sitemap.mjs --strict-out
```
