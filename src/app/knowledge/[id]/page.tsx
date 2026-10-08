import { LegacyKnowledgeRedirect } from "@/components/LegacyKnowledgeRedirect";
import {
  LEGACY_KNOWLEDGE_CHAPTER_TO_KP,
  resolveLegacyKnowledgeTarget,
} from "@/lib/knowledge-legacy-redirects";

export function generateStaticParams() {
  return Object.keys(LEGACY_KNOWLEDGE_CHAPTER_TO_KP).map((id) => ({ id }));
}

export default async function LegacyKnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const target = resolveLegacyKnowledgeTarget(decodeURIComponent(id)) ?? "/kb/";
  return <LegacyKnowledgeRedirect target={target} />;
}
