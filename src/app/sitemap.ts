import type { MetadataRoute } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { absoluteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

type KbIndex = {
  meta?: { apiPolish?: string; effective?: string };
  sections?: { items?: { id: string; path?: string }[] }[];
};

function readKbIds(): string[] {
  const raw = readFileSync(join(process.cwd(), "public/data/kb-index.json"), "utf8");
  const data = JSON.parse(raw) as KbIndex;
  const ids: string[] = [];
  for (const sec of data.sections ?? []) {
    for (const it of sec.items ?? []) {
      if (!it.id || !it.path || it.path.endsWith("/")) continue;
      ids.push(it.id);
    }
  }
  return ids;
}

function kbLastModified(index: KbIndex): Date | undefined {
  const d = index.meta?.apiPolish || index.meta?.effective;
  if (!d) return undefined;
  const t = Date.parse(d);
  return Number.isNaN(t) ? undefined : new Date(t);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const kbRaw = readFileSync(join(process.cwd(), "public/data/kb-index.json"), "utf8");
  const kbIndex = JSON.parse(kbRaw) as KbIndex;
  const kbModified = kbLastModified(kbIndex);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/kb"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/case"), changeFrequency: "weekly", priority: 0.85 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/changelog"), changeFrequency: "weekly", priority: 0.4 },
  ];

  const kbRoutes: MetadataRoute.Sitemap = readKbIds().map((id) => ({
    url: absoluteUrl(`/kb/${id}`),
    lastModified: kbModified,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...kbRoutes];
}
