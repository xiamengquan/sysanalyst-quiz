"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Crosshair, FileText, ListChecks } from "lucide-react";
import type { CaseItem, Question } from "@/lib/types";
import { CH_NAMES } from "@/lib/types";
import { QuizApp } from "@/components/QuizApp";
import { ExamSprintBanner } from "@/components/ExamCountdown";
import { storageGet, storageSet } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** 关注章节 IDB 键（真题分割刷） */
const FOCUS_CHAPTERS_KEY = "sysanalyst_focus_chapters_v1";

type SessionInfo = {
  key: string;
  label: string;
  choiceCount: number;
  caseCount: number;
};

export function formatSessionLabel(key: string) {
  const m = key.match(/^(\d{4})(上|下)?$/);
  if (!m) return key;
  const half = m[2] === "下" ? "下半年" : "上半年";
  return `${m[1]} ${half}`;
}

export function RealExamApp() {
  const searchParams = useSearchParams();
  const session = searchParams.get("session");
  const [all, setAll] = useState<Question[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusChapters, setFocusChapters] = useState<number[]>([]);
  const [focusLoaded, setFocusLoaded] = useState(false);

  // 关注章节持久化（IndexedDB）
  useEffect(() => {
    storageGet<number[]>(FOCUS_CHAPTERS_KEY)
      .then((v) => {
        if (Array.isArray(v) && v.length > 0) setFocusChapters(v);
      })
      .finally(() => setFocusLoaded(true));
  }, []);
  const toggleFocus = (c: number) =>
    setFocusChapters((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].sort((a, b) => a - b);
      void storageSet(FOCUS_CHAPTERS_KEY, next);
      return next;
    });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/questions.json").then((r) => r.json()),
      fetch("/data/cases.json").then((r) => r.json()),
    ])
      .then(([qs, cs]) => {
        if (cancelled) return;
        setAll(Array.isArray(qs) ? qs : []);
        setCases(Array.isArray(cs) ? cs : []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sessions = useMemo<SessionInfo[]>(() => {
    const map = new Map<string, SessionInfo>();
    const ensure = (key: string): SessionInfo => {
      let e = map.get(key);
      if (!e) {
        e = { key, label: formatSessionLabel(key), choiceCount: 0, caseCount: 0 };
        map.set(key, e);
      }
      return e;
    };
    all
      .filter((q) => q.bank === "real" && q.year)
      .forEach((q) => ensure(`${q.year}${q.half || ""}`).choiceCount++);
    cases
      .filter((c) => c.bank === "real" && c.year)
      .forEach((c) => ensure(`${c.year}${c.half || ""}`).caseCount++);
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key, "zh"));
  }, [all, cases]);

  /** 真题章节分布（打标后 ch 0–22；99=未分类归「其他」），供分割刷 */
  const realChDist = useMemo(() => {
    const m = new Map<number, number>();
    all.filter((q) => q.bank === "real").forEach((q) => m.set(q.ch, (m.get(q.ch) || 0) + 1));
    return [...m.entries()].sort((a, b) => (a[0] === 99 ? 1 : b[0] === 99 ? -1 : a[0] - b[0]));
  }, [all]);

  if (loading) return <p className="text-muted-foreground">加载真题库中…</p>;

  // 深链分割刷：/real-exams/?session=all&chapters=8,11,12
  const chaptersParam = searchParams.get("chapters");
  const initialChapters = chaptersParam
    ? chaptersParam
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0)
    : undefined;

  // 场次作答视图：复用刷题引擎的真题模式
  if (session) {
    return (
      <div>
        <div className="mb-3">
          <Link
            href="/real-exams/"
            className="inline-flex items-center gap-1 text-[0.85rem] text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            返回真题目录{session !== "all" ? ` · ${formatSessionLabel(session)}` : " · 全部场次"}
          </Link>
        </div>
        <QuizApp
          realExamMode
          initialYearHalf={session === "all" ? undefined : session}
          initialChapters={initialChapters && initialChapters.length > 0 ? initialChapters : undefined}
        />
      </div>
    );
  }

  const fullSessions = sessions.filter((s) => s.choiceCount === 75);
  const partialSessions = sessions.filter((s) => s.choiceCount > 0 && s.choiceCount !== 75);
  const totalChoice = sessions.reduce((n, s) => n + s.choiceCount, 0);
  const totalCase = sessions.reduce((n, s) => n + s.caseCount, 0);
  const focusCount = focusChapters.reduce(
    (n, c) => n + (realChDist.find(([k]) => k === c)?.[1] || 0),
    0
  );
  const focusHref =
    focusChapters.length > 0
      ? `/real-exams/?session=all&chapters=${focusChapters.join(",")}`
      : "/real-exams/?session=all";

  return (
    <>
      <h1 className="page-title">真题系统</h1>
      <p className="page-lead">
        综合知识真题 {totalChoice} 道（{sessions.length} 场）· 案例真题 {totalCase} 道 ·
        覆盖 2014 上半年 — 2026 上半年
        <br />
        <span className="text-[0.82rem]">
          与练习系统分离：按场次成卷刷真题，配合案例真题与练习巩固错题考点
        </span>
      </p>

      <ExamSprintBanner />

      <Card className="px-(--card-spacing) mb-4 border-primary/25">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Crosshair className="size-4" />
          </span>
          <div>
            <h2 className="text-[1rem] font-medium">只刷我关注的真题 · 按章节分割</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              勾选关注的章节（自动记住），只刷这部分真题——距考试只剩几天，把时间花在刀刃上
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {realChDist.map(([c, n]) => {
            const active = focusLoaded && focusChapters.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                )}
                onClick={() => toggleFocus(c)}
              >
                {c === 99 ? "其他" : CH_NAMES[c] || `第${c}章`} · {n}
              </button>
            );
          })}
        </div>
        <Link
          href={focusHref}
          className={cn(
            "mt-3 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[0.92rem] font-medium transition-colors",
            focusChapters.length > 0
              ? "border border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/[0.12]"
              : "border border-border bg-muted/30 text-muted-foreground"
          )}
        >
          {focusChapters.length > 0
            ? `只刷我关注的（${focusChapters.length} 章 · ${focusCount} 题）`
            : "先勾选上方章节，再开始分割刷"}
        </Link>
      </Card>

      <Card className="px-(--card-spacing) mb-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ListChecks className="size-4" />
          </span>
          <div>
            <h2 className="text-[1rem] font-medium">综合知识真题 · 按场次成卷</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              完整场次每卷 75 题 · 与上午考场题序一致
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/real-exams/?session=all"
            className="rounded-lg border border-primary/30 bg-primary/[0.04] px-3 py-2.5 transition-colors hover:bg-primary/[0.08]"
          >
            <span className="text-[0.92rem] font-medium text-foreground">全部场次 · 乱序综合</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              {totalChoice} 题混合作答，适合碎片时间滚动刷
            </span>
          </Link>
          {fullSessions.map((s) => (
            <Link
              key={s.key}
              href={`/real-exams/?session=${encodeURIComponent(s.key)}`}
              className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60"
            >
              <span className="text-[0.92rem] font-medium text-foreground">
                {s.label} · {s.choiceCount} 题
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                完整卷{s.caseCount > 0 ? ` · 含案例真题 ${s.caseCount} 道` : ""}
              </span>
            </Link>
          ))}
          {partialSessions.map((s) => (
            <Link
              key={s.key}
              href={`/real-exams/?session=${encodeURIComponent(s.key)}`}
              className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="text-[0.92rem] font-medium text-foreground">
                {s.label} · {s.choiceCount} 题
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                部分卷（题目待补齐）{s.caseCount > 0 ? ` · 含案例真题 ${s.caseCount} 道` : ""}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="px-(--card-spacing)">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <FileText className="size-4" />
          </span>
          <div>
            <h2 className="text-[1rem] font-medium">案例分析真题 · 按场次</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              进入案例系统的真题分池作答（含评分要点与七步法解析）
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {sessions
            .filter((s) => s.caseCount > 0)
            .map((s) => (
              <Link
                key={s.key}
                href={`/case/?bank=real&year=${encodeURIComponent(s.key)}`}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <span className="text-[0.92rem] font-medium text-foreground">
                  {s.label} · {s.caseCount} 道
                </span>
              </Link>
            ))}
          <Link
            href="/case/?bank=real"
            className="rounded-lg border border-primary/30 bg-primary/[0.04] px-3 py-2.5 transition-colors hover:bg-primary/[0.08]"
          >
            <span className="text-[0.92rem] font-medium text-foreground">
              全部案例真题 · {totalCase} 道
            </span>
          </Link>
        </div>
      </Card>
    </>
  );
}