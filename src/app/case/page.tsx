import { Suspense } from "react";
import { CaseApp } from "@/components/CaseApp";

export default function CasePage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">加载案例系统中…</p>}>
      <CaseApp />
    </Suspense>
  );
}