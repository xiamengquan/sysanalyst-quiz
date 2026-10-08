/** 站点 canonical 根 URL（构建时 NEXT_PUBLIC_SITE_URL，默认生产域名） */
export function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  const base = raw || "https://maintruly.top";
  return base.replace(/\/+$/, "");
}

/** 拼绝对 URL；路径段 UTF-8 编码，与 trailingSlash 一致以 `/` 结尾 */
export function absoluteUrl(pathname: string): string {
  const base = siteUrl();
  let p = pathname.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  const segments = p.split("/").filter(Boolean);
  const encoded = segments.map((seg) => encodeURIComponent(decodeURIComponent(seg)));
  const path = encoded.length ? `/${encoded.join("/")}/` : "/";
  return `${base}${path}`;
}
