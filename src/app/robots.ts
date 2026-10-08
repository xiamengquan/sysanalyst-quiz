import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const host = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/knowledge/", "/*?*"],
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/knowledge/", "/*?*"],
        crawlDelay: 1,
      },
      {
        userAgent: "Yandex",
        allow: "/",
        disallow: ["/knowledge/", "/*?*"],
        crawlDelay: 1,
      },
    ],
    host,
    sitemap: `${host}/sitemap.xml`,
  };
}
