import { readFileSync } from "fs";
import { join } from "path";
import { KbReader } from "@/components/KbApp";

export function generateStaticParams() {
  const raw = readFileSync(join(process.cwd(), "public/data/kb-index.json"), "utf8");
  const data = JSON.parse(raw) as { sections: { items: { id: string }[] }[] };
  return data.sections.flatMap((s) => s.items.map((i) => ({ id: i.id })));
}

export default async function KbDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KbReader id={id} />;
}
