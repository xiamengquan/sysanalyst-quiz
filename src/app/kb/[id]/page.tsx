import { readFileSync } from "fs";
import { join } from "path";
import { KbReader } from "@/components/KbApp";
import { kbRouteAliasIds } from "@/lib/kb-route-aliases";
import { normalizeKbRouteId } from "@/lib/kb-resolve";

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
  return <KbReader id={normalizeKbRouteId(rawId)} />;
}
