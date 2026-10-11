"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, ChevronLeft, RotateCcw, Shuffle } from "lucide-react";
import {
  MAX_BOX,
  RECALL_STORAGE_KEY,
  applyGrade,
  boxDistribution,
  isCardDue,
  newRecallState,
  todayKey,
  type Flashcard,
  type FlashcardsData,
  type RecallGrade,
  type RecallState,
} from "@/lib/flashcards";
import { SEVEN_DAYS } from "@/lib/kb-seven-day";
import { storageGet, storageSet } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function shuffle<T>(items: T[]): T[] {
  const r = [...items];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const DAY_FILTERS = [
  { value: "all", label: "全部" },
  ...SEVEN_DAYS.map((d) => ({ value: d.id, label: `${d.label} ${d.theme}` })),
];

const TIER_FILTERS = [
  { value: "all", label: "全部层级" },
  { value: "M", label: "必会 M" },
  { value: "K", label: "重点 K" },
];

const SESSION_SIZES = [10, 20, 0]; // 0 = 全部到期

function dayLabel(day: string | null): string {
  if (!day) return "综合";
  const d = SEVEN_DAYS.find((x) => x.id === day);
  return d ? d.label : day;
}

export function RecallApp() {
  const [data, setData] = useState<FlashcardsData | null>(null);
  const [state, setState] = useState<RecallState>(newRecallState());
  const [ready, setReady] = useState(false);
  const [dayFilter, setDayFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [sessionSize, setSessionSize] = useState(10);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [sessionStat, setSessionStat] = useState({ forgot: 0, fuzzy: 0, known: 0 });
  const [phase, setPhase] = useState<"setup" | "quiz" | "done">("setup");

  useEffect(() => {
    Promise.all([
      fetch("/data/flashcards.json").then((r) => r.json()),
      storageGet<RecallState>(RECALL_STORAGE_KEY),
    ])
      .then(([d, s]) => {
        setData(d);
        if (s && typeof s === "object" && s.progress) setState(s);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.cards.filter(
      (c) =>
        (dayFilter === "all" || c.day === dayFilter) &&
        (tierFilter === "all" || c.tier === tierFilter)
    );
  }, [data, dayFilter, tierFilter]);

  const dueList = useMemo(() => filtered.filter((c) => isCardDue(c, state)), [filtered, state]);
  const distribution = useMemo(() => boxDistribution(filtered, state), [filtered, state]);

  const start = useCallback(() => {
    const due = shuffle(dueList);
    const rest = shuffle(filtered.filter((c) => !isCardDue(c, state)));
    const n = sessionSize === 0 ? dueList.length : sessionSize;
    const q = [...due, ...rest].slice(0, Math.max(n, Math.min(due.length, 5)));
    if (!q.length) {
      alert("当前筛选没有可用卡片");
      return;
    }
    setQueue(q);
    setIdx(0);
    setShown(false);
    setSessionStat({ forgot: 0, fuzzy: 0, known: 0 });
    setPhase("quiz");
  }, [dueList, filtered, state, sessionSize]);

  const current = queue[idx];

  const grade = useCallback(
    (g: RecallGrade) => {
      if (!current) return;
      setState((s) => {
        const next = applyGrade(s, current, g);
        void storageSet(RECALL_STORAGE_KEY, next);
        return next;
      });
      setSessionStat((s) => ({ ...s, [g]: s[g] + 1 }));
      if (idx >= queue.length - 1) setPhase("done");
      else {
        setIdx((i) => i + 1);
        setShown(false);
      }
    },
    [current, idx, queue.length]
  );

  const reset = useCallback(() => {
    if (!confirm("确定清空全部问答进度（回到全新卡）？")) return;
    const s = newRecallState();
    setState(s);
    void storageSet(RECALL_STORAGE_KEY, s);
    setPhase("setup");
  }, []);

  if (!ready) return <p className="text-muted-foreground">加载卡库中…</p>;

  const todayCount = state.today && state.today.date === todayKey() ? state.today.count : 0;

  return (
    <>
      <h1 className="page-title">随机问答 · 必会与重点</h1>
      <p className="page-lead">
        {data?.meta.total ?? "—"} 张卡：总册必会默写卡 M {data?.meta.m ?? "—"} + 记忆卡组硬记忆点 K{" "}
        {data?.meta.k ?? "—"}（★ 错卡高发 {data?.meta.hard ?? "—"}）
        <br />
        <span className="text-[0.82rem]">
          先默写再看答案 · 自评后按 1-2-4-7-15 间隔排程 · 进度存本机
        </span>
      </p>

      {phase === "setup" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            {[
              ["到期待复习", dueList.length],
              ["今日已复习", todayCount],
              ["卡库总量", filtered.length],
              ["毕业卡", distribution[MAX_BOX]],
            ].map(([k, v]) => (
              <Card key={String(k)} className="p-3.5 text-center">
                <span className="text-[0.75rem] text-muted-foreground">{k}</span>
                <b className="mt-1 block text-[1.2rem]">{v}</b>
              </Card>
            ))}
          </div>

          <Card className="px-(--card-spacing) mb-4 space-y-4">
            <div>
              <h2 className="mb-2 text-[1rem] font-medium">范围（总册日次）</h2>
              <div className="flex flex-wrap gap-1.5">
                {DAY_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setDayFilter(f.value)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[0.8rem] transition-colors",
                      dayFilter === f.value
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <h2 className="mb-2 text-[1rem] font-medium">层级</h2>
                <div className="flex flex-wrap gap-1.5">
                  {TIER_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setTierFilter(f.value)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[0.8rem] transition-colors",
                        tierFilter === f.value
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="mb-2 text-[1rem] font-medium">本轮题量</h2>
                <div className="flex flex-wrap gap-1.5">
                  {SESSION_SIZES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSessionSize(n)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[0.8rem] transition-colors",
                        sessionSize === n
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {n === 0 ? `全部到期（${dueList.length}）` : `${n} 张`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="btn-row">
              <Button type="button" variant="default" onClick={start} className="gap-1.5 shadow-xs">
                <Shuffle className="size-4" />
                <span>开始随机问答（到期优先）</span>
              </Button>
              <Button type="button" variant="ghost" onClick={reset} className="gap-1">
                <RotateCcw className="size-4" />
                清空进度
              </Button>
            </div>
            <p className="text-[0.78rem] text-muted-foreground">
              盒级分布：新 {distribution[0]} ·{" "}
              {distribution
                .slice(1)
                .map((n, i) => `盒${i + 1}（隔${[1, 2, 4, 7, 15][i]}天）${n}`)
                .join(" · ")}
            </p>
          </Card>
        </>
      )}

      {phase === "quiz" && current && (
        <Card className="px-(--card-spacing) mb-4">
          <div className="mb-3 flex items-center justify-between text-[0.85rem] text-muted-foreground">
            <span>
              第 {idx + 1} / {queue.length} 张
            </span>
            <span>
              忘了 {sessionStat.forgot} · 模糊 {sessionStat.fuzzy} · 记住 {sessionStat.known}
            </span>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <span className="badge">{current.tier === "M" ? "必会 M" : "重点 K"}</span>
            <span className="badge">{dayLabel(current.day)}</span>
            {current.hard ? (
              <span className="badge border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                ★ 错卡高发
              </span>
            ) : null}
            {state.progress[current.id] ? (
              <span className="badge">盒 {state.progress[current.id].box}</span>
            ) : (
              <span className="badge">新卡</span>
            )}
          </div>
          <div className="mb-6 rounded-[12px] border border-border bg-muted/40 p-5 text-[1.05rem] leading-[1.7] font-medium whitespace-pre-wrap break-words sm:text-[1.1rem]">
            {current.front}
          </div>
          {!shown ? (
            <div className="sticky-actions">
              <div className="sticky-actions-primary">
                <Button type="button" variant="default" onClick={() => setShown(true)}>
                  显示答案（先默写）
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-5 rounded-[12px] border border-emerald-500/40 bg-emerald-500/10 p-5 text-[1rem] leading-[1.75] whitespace-pre-wrap break-words">
                {current.back}
              </div>
              <p className="mb-2.5 text-[0.82rem] text-muted-foreground">
                对照刚才的默写，诚实自评：
              </p>
              <div className="btn-row">
                <Button type="button" variant="outline" onClick={() => grade("forgot")}>
                  忘了（回 1 盒）
                </Button>
                <Button type="button" variant="outline" onClick={() => grade("fuzzy")}>
                  模糊（原地）
                </Button>
                <Button type="button" variant="default" onClick={() => grade("known")}>
                  记住（升盒）
                </Button>
              </div>
            </>
          )}
          <div className="sticky-actions mt-4 border-t border-border pt-4">
            <div className="sticky-actions-primary">
              <Button type="button" variant="ghost" onClick={() => setPhase("setup")} className="gap-1">
                <ChevronLeft className="size-4" />
                结束本轮
              </Button>
            </div>
            <div className="sticky-actions-more">
              <Link
                href={current.src.href}
                className="text-[0.82rem] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                出处：{current.src.label}
              </Link>
            </div>
          </div>
        </Card>
      )}

      {phase === "done" && (
        <Card className="px-(--card-spacing) mb-4">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Brain className="size-4" />
            </span>
            <h2 className="text-[1.05rem] font-semibold">本轮完成</h2>
          </div>
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              ["忘了", sessionStat.forgot, "text-rose-600 dark:text-rose-400"],
              ["模糊", sessionStat.fuzzy, "text-amber-600 dark:text-amber-400"],
              ["记住", sessionStat.known, "text-emerald-600 dark:text-emerald-400"],
            ].map(([k, v, cls]) => (
              <div key={String(k)} className="rounded-[12px] border border-border bg-muted/40 p-3.5 text-center">
                <span className="text-[0.75rem] text-muted-foreground">{k}</span>
                <b className={cn("mt-1 block text-[1.3rem]", cls)}>{v}</b>
              </div>
            ))}
          </div>
          <p className="mb-4 text-[0.88rem] leading-relaxed text-muted-foreground">
            「忘了」的卡片回到 1 盒（隔 1 天再出现）；「记住」的卡片升盒，间隔拉长到 2/4/7/15 天。
            明天再来时，到期卡会优先出现。今日已复习 <b className="text-foreground">{todayCount}</b> 张。
          </p>
          <div className="btn-row">
            <Button type="button" variant="default" onClick={() => setPhase("setup")}>
              再来一轮
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/kb/">回知识点主页</Link>
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}