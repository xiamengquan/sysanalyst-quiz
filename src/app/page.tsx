import { Suspense } from "react";
import { QuizApp } from "@/components/QuizApp";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">加载题库中…</p>}>
      <QuizApp />
    </Suspense>
  );
}
