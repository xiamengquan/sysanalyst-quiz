"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 旧中文 slug 等访问时 replace 到英文 canonical（静态站等价 301） */
export function KbCanonicalRedirect({
  rawRouteId,
  canonicalId,
}: {
  rawRouteId: string;
  canonicalId: string;
}) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/kb/${encodeURIComponent(canonicalId)}/`);
  }, [canonicalId, router]);
  return (
    <main className="mx-auto max-w-lg px-4 py-12 text-sm text-muted-foreground">
      正在跳转到最新知识点地址…
      <span className="sr-only">
        {rawRouteId} → {canonicalId}
      </span>
    </main>
  );
}
