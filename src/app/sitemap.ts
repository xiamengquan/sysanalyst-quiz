import type { MetadataRoute } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-static";

type SitemapUrlsFile = {
  urls: Array<{
    url: string;
    lastModified?: string;
    changeFrequency?: string;
    priority?: number;
  }>;
};

/** Next.js Metadata Route：静态 export 时输出 out/sitemap.xml */
export default function sitemap(): MetadataRoute.Sitemap {
  const raw = readFileSync(join(process.cwd(), "public/data/sitemap-urls.json"), "utf8");
  const { urls } = JSON.parse(raw) as SitemapUrlsFile;
  return urls.map((u) => ({
    url: u.url,
    lastModified: u.lastModified ? new Date(u.lastModified) : undefined,
    changeFrequency: (u.changeFrequency ?? "monthly") as MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: u.priority,
  }));
}
