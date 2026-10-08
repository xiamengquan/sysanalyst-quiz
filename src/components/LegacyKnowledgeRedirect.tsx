"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LegacyKnowledgeRedirect({ target }: { target: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(target);
  }, [target, router]);
  return (
    <main className="mx-auto max-w-lg px-4 py-12 text-sm text-muted-foreground">
      正在跳转到知识点…
    </main>
  );
}
