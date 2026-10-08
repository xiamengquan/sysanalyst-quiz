import { readFileSync } from "fs";
import { join } from "path";
import { KbReader } from "@/components/KbApp";
import { KbCanonicalRedirect } from "@/components/KbCanonicalRedirect";
import { kbRouteAliasIds, resolveKbRouteAlias } from "@/lib/kb-route-aliases";
import { normalizeKbRouteId } from "@/lib/kb-resolve";

function decodeRouteId(raw: string): string {
  let s = raw.trim();
  for (let i = 0; i < 3; i++) {
    if (!/%[0-9A-Fa-f]{2}/.test(s)) break;
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }
  return s;
}

export function generateStaticParams() {
  const raw = readFileSync(join(process.cwd(), "public/data/kb-index.json"), "utf8");
  const data = JSON.parse(raw) as { sections: { items: { id: string }[] }[] };
  const ids = new Set(data.sections.flatMap((s) => s.items.map((i) => i.id)));
  for (const alias of kbRouteAliasIds()) ids.add(alias);
  return [...ids].map((id) => ({ id }));
}

export default async function KbDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const decoded = decodeRouteId(rawId);
  const canonical = resolveKbRouteAlias(decoded);
  if (canonical !== decoded) {
    return <KbCanonicalRedirect rawRouteId={decoded} canonicalId={canonical} />;
  }
  return <KbReader id={normalizeKbRouteId(rawId)} />;
}
