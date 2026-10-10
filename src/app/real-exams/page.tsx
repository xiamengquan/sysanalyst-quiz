import { Suspense } from "react";
import { RealExamApp } from "@/components/RealExamApp";

export default function RealExamsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">加载真题库中…</p>}>
      <RealExamApp />
    </Suspense>
  );
}