"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, RotateCcw, Undo2 } from "lucide-react";
import {
  EXAM_DATE,
  SPRINT_END,
  SPRINT_START,
  SLOT_META,
  buildFallbackTasks,
  buildTodayTasks,
  dateKey,
  planRoster,
  shiftDate,
  sprintDayNumber,
  type TodayTasks,
} from "@/lib/today-plan";
import { storageGet, storageSet } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CHECKS_KEY = "sysanalyst_today_checks_v1";

type CheckStore = Record<string, Record<string, boolean>>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function TodayApp({ embedded = false }: { embedded?: boolean }) {
  const today = useMemo(() => dateKey(), []);
  const [viewDate, setViewDate] = useState(today);
  const [overview, setOverview] = useState(false);
  const [tasks, setTasks] = useState<TodayTasks | null>(null);
  const [store, setStore] = useState<CheckStore>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 深链 /today/?date=YYYY-MM-DD：直接切到该日
    const q = new URLSearchParams(window.location.search).get("date");
    if (q && DATE_RE.test(q) && q !== today) setViewDate(q);
  }, [today]);

  useEffect(() => {
    const built = buildTodayTasks(viewDate) || buildFallbackTasks(viewDate);
    setTasks(built);
    storageGet<CheckStore>(CHECKS_KEY)
      .then((s) => setStore(s ?? {}))
      .catch(() => setStore({}))
      .finally(() => setReady(true));
  }, [viewDate]);

  // 日期切换时同步深链（不触发导航）
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (viewDate === today) url.searchParams.delete("date");
      else url.searchParams.set("date", viewDate);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }, [viewDate, today]);

  const checks = store[viewDate] ?? {};
  const roster = useMemo(() => planRoster(), []);

  const allIds = useMemo(
    () => (tasks ? tasks.groups.flatMap((g) => g.tasks.map((t) => t.id)) : []),
    [tasks]
  );
  const done = allIds.filter((id) => checks[id]).length;
  const total = allIds.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const persist = useCallback((next: CheckStore) => {
    void storageSet(CHECKS_KEY, next);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setStore((s) => {
        const cur = s[viewDate] ?? {};
        const next: Record<string, boolean> = { ...cur };
        if (next[id]) delete next[id];
        else next[id] = true;
        const store2 = { ...s, [viewDate]: next };
        persist(store2);
        return store2;
      });
    },
    [viewDate, persist]
  );

  const reset = useCallback(() => {
    setStore((s) => {
      const store2 = { ...s };
      delete store2[viewDate];
      persist(store2);
      return store2;
    });
  }, [viewDate, persist]);

  const goDay = useCallback((d: string) => {
    setOverview(false);
    setViewDate(d);
  }, []);

  if (!ready || !tasks) return <p className="text-muted-foreground">加载今日任务中…</p>;

  const isToday = viewDate === today;
  const sprintDay = sprintDayNumber(viewDate);
  const toExam = daysUntilExamOf(viewDate);
  const allDone = total > 0 && done === total;

  // 总控台内嵌模式：只渲染执行单本体（进度 + 任务组），勾选实时写回基线
  if (embedded) {
    return (
      <div className="mx-auto w-full">
        <Card className="px-(--card-spacing) mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between text-[0.82rem]">
                <span className="text-muted-foreground">
                  {isToday ? "今日进度" : `${viewDate} 进度`} <b className="text-foreground">{done}</b> / {total}
                </span>
                <span className={cn("font-medium", allDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                  {pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", allDone ? "bg-emerald-500" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="shrink-0 gap-1 text-muted-foreground">
              <RotateCcw className="size-3.5" />
              重置
            </Button>
          </div>
          {allDone && (
            <p className="mt-3 rounded-[10px] border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[0.85rem] text-emerald-700 dark:text-emerald-300">
              🎉 该日任务全部完成——这就是当天的胜利，早点休息，第二天排程会自动就位。
            </p>
          )}
        </Card>
        {tasks.groups.map((g) => {
          const meta = SLOT_META[g.slot];
          return (
            <Card key={g.slot} className="px-(--card-spacing) mb-3">
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-[0.95rem] font-medium text-foreground">{meta.label}</h2>
                <span className="text-[0.75rem] text-muted-foreground">{meta.time}</span>
              </div>
              <div className="space-y-1.5">
                {g.tasks.map((t) => {
                  const checked = !!checks[t.id];
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-start gap-2.5 rounded-[10px] border p-2.5 transition-colors",
                        checked ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-border bg-muted/30"
                      )}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        aria-label={t.text}
                        onClick={() => toggle(t.id)}
                        className={cn(
                          "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors",
                          checked
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border bg-background hover:border-foreground/40"
                        )}
                      >
                        {checked && <CheckCheck className="size-3" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[0.88rem] leading-relaxed", checked && "text-muted-foreground line-through")}>
                          {t.text}
                        </p>
                        {t.href && (
                          <Link
                            href={t.href}
                            className="mt-0.5 inline-block text-[0.76rem] text-primary underline underline-offset-2 hover:opacity-80"
                          >
                            {t.link ?? "直达"} →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
        <p className="mt-2 text-center text-[0.75rem] text-muted-foreground">
          勾选实时写回基线 · 完整日期导航与 15 天总览见{" "}
          <Link href="/today/" className="underline underline-offset-2 hover:text-foreground">
            /today/ 执行单
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-title">今日任务 · 对照执行</h1>
      <p className="page-lead">
        每天一份当天计划：勾选进度按日期分档存本机。
        <span className="text-[0.82rem]">
          {toExam > 0 ? ` 距考试（${EXAM_DATE}）还有 ${toExam} 天 · ` : ""}
          计划全文见{" "}
          <Link href="/kb/quick-sprint-14d/" className="underline underline-offset-2 hover:text-foreground">
            考前 14 天冲刺计划
          </Link>
        </span>
      </p>

      {/* 日期导航 */}
      <Card className="px-(--card-spacing) mb-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setViewDate((d) => shiftDate(d, -1))}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1.5 text-[0.82rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="前一天"
          >
            <ChevronLeft className="size-4" aria-hidden /> 前一天
          </button>
          <div className="min-w-0 text-center">
            <div className="flex flex-wrap items-baseline justify-center gap-2">
              <b className="text-[0.95rem]">{viewDate}</b>
              <span className="text-[0.78rem] text-muted-foreground">{tasks.plan.weekday}</span>
              {isToday && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary">今天</span>
              )}
            </div>
            <div className="mt-0.5 text-[0.75rem] text-muted-foreground">
              {sprintDay > 0 && sprintDay < 15 ? `冲刺第 ${sprintDay}/14 天 · ` : ""}
              {tasks.plan.tag}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setViewDate((d) => shiftDate(d, 1))}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1.5 text-[0.82rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="后一天"
          >
            后一天 <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          {!isToday && (
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setViewDate(today)}>
              <Undo2 className="size-3.5" aria-hidden /> 回到今天
            </Button>
          )}
          <Button
            type="button"
            variant={overview ? "default" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => setOverview((o) => !o)}
          >
            <CalendarDays className="size-3.5" aria-hidden /> {overview ? "返回当日任务" : "冲刺 15 天总览"}
          </Button>
        </div>
      </Card>

      {overview ? (
        <div className="mb-4 space-y-2">
          {roster.map((r) => {
            const dayTasks = buildTodayTasks(r.date) || buildFallbackTasks(r.date);
            const ids = dayTasks.groups.flatMap((g) => g.tasks.map((t) => t.id));
            const d2 = Object.values(store[r.date] ?? {}).filter(Boolean).length;
            const t2 = ids.length;
            const p2 = t2 ? Math.round((d2 / t2) * 100) : 0;
            const isTodayRow = r.date === today;
            return (
              <button
                key={r.date}
                type="button"
                onClick={() => goDay(r.date)}
                className={cn(
                  "w-full rounded-[12px] border p-3 text-left transition-colors",
                  isTodayRow
                    ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-muted/30 hover:bg-muted"
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <b className="text-[0.88rem]">{r.date}</b>
                      <span className="text-[0.72rem] text-muted-foreground">{r.weekday.split("（")[0]}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">{r.tag}</span>
                      {isTodayRow && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary">今天</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-1 text-[0.78rem] text-muted-foreground">
                      {dayTasks.groups.find((g) => g.slot === "main")?.tasks[0]?.text ?? dayTasks.plan.tag}
                    </p>
                  </div>
                  <div className="w-24 shrink-0 text-right">
                    <span className={cn("text-[0.78rem] font-medium", d2 >= t2 && t2 > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                      {d2}/{t2}
                    </span>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", d2 >= t2 && t2 > 0 ? "bg-emerald-500" : "bg-primary/70")}
                        style={{ width: `${p2}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          <p className="text-center text-[0.75rem] text-muted-foreground">点任意一天查看并勾选该日任务</p>
        </div>
      ) : (
        <>
          <Card className="px-(--card-spacing) mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-baseline justify-between text-[0.82rem]">
                  <span className="text-muted-foreground">
                    {isToday ? "今日进度" : `${viewDate} 进度`} <b className="text-foreground">{done}</b> / {total}
                  </span>
                  <span className={cn("font-medium", allDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                    {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", allDone ? "bg-emerald-500" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={reset} className="shrink-0 gap-1 text-muted-foreground">
                <RotateCcw className="size-3.5" />
                重置
              </Button>
            </div>
            {allDone && (
              <p className="mt-3 rounded-[10px] border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[0.85rem] text-emerald-700 dark:text-emerald-300">
                🎉 该日任务全部完成——这就是当天的胜利，早点休息，第二天排程会自动就位。
              </p>
            )}
          </Card>

          {tasks.groups.map((g) => {
            const meta = SLOT_META[g.slot];
            return (
              <Card key={g.slot} className="px-(--card-spacing) mb-3">
                <div className="mb-2.5 flex items-baseline justify-between">
                  <h2 className="text-[0.95rem] font-medium text-foreground">{meta.label}</h2>
                  <span className="text-[0.75rem] text-muted-foreground">{meta.time}</span>
                </div>
                <div className="space-y-1.5">
                  {g.tasks.map((t) => {
                    const checked = !!checks[t.id];
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "flex items-start gap-2.5 rounded-[10px] border p-2.5 transition-colors",
                          checked ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-border bg-muted/30"
                        )}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          aria-label={t.text}
                          onClick={() => toggle(t.id)}
                          className={cn(
                            "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors",
                            checked
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-border bg-background hover:border-foreground/40"
                          )}
                        >
                          {checked && <CheckCheck className="size-3" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[0.88rem] leading-relaxed", checked && "text-muted-foreground line-through")}>
                            {t.text}
                          </p>
                          {t.href && (
                            <Link
                              href={t.href}
                              className="mt-0.5 inline-block text-[0.76rem] text-primary underline underline-offset-2 hover:opacity-80"
                            >
                              {t.link ?? "直达"} →
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </>
      )}

      <p className="mt-4 text-center text-[0.78rem] text-muted-foreground">
        冲刺窗口 {SPRINT_START} ~ {SPRINT_END} · 考试 {EXAM_DATE} · 任务与
        <Link href="/kb/quick-sprint-14d/" className="mx-1 underline underline-offset-2 hover:text-foreground">
          冲刺计划文档
        </Link>
        保持一致
      </p>
    </>
  );
}

function daysUntilExamOf(dateKeyStr: string): number {
  const [y, m, dd] = EXAM_DATE.split("-").map(Number);
  const [yy, mm, d3] = dateKeyStr.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(yy, mm - 1, d3)) / 86_400_000);
}