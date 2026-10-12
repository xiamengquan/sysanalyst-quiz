"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brain, CheckCircle2, ChevronLeft, RotateCcw, Send, Shuffle, TriangleAlert, XCircle } from "lucide-react";
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
import { judgeAnswer, type MatchResult } from "@/lib/answer-match";
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
  const [daySet, setDaySet] = useState<string[]>([]); // 空 = 全部；支持多选
  const [tierFilter, setTierFilter] = useState("all");
  const [sessionSize, setSessionSize] = useState(10);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [sessionStat, setSessionStat] = useState({ forgot: 0, fuzzy: 0, known: 0 });
  const [phase, setPhase] = useState<"setup" | "quiz" | "done">("setup");
  const answerRef = useRef<HTMLTextAreaElement>(null);

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
        (daySet.length === 0 || (c.day !== null && daySet.includes(c.day))) &&
        (tierFilter === "all" || c.tier === tierFilter)
    );
  }, [data, daySet, tierFilter]);

  const dueList = useMemo(() => filtered.filter((c) => isCardDue(c, state)), [filtered, state]);
  const dueReviewCount = useMemo(
    () => dueList.filter((c) => !!state.progress[c.id]).length,
    [dueList, state]
  );
  const dueNewCount = dueList.length - dueReviewCount;
  const distribution = useMemo(() => boxDistribution(filtered, state), [filtered, state]);

  const start = useCallback(() => {
    // 到期卡内先复习到期（有进度的），再喂新卡，避免新卡挤占复习债
    const due =
      shuffle(dueList.filter((c) => state.progress[c.id])).concat(
        shuffle(dueList.filter((c) => !state.progress[c.id]))
      );
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
    setAnswer("");
    setResult(null);
    setSessionStat({ forgot: 0, fuzzy: 0, known: 0 });
    setPhase("quiz");
  }, [dueList, filtered, state, sessionSize]);

  // 切卡：清空作答与判定，聚焦输入框
  useEffect(() => {
    setAnswer("");
    setResult(null);
    if (phase === "quiz") answerRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const current = queue[idx];

  const submit = useCallback(() => {
    if (!current || !answer.trim()) return;
    setResult(judgeAnswer(current.front, current.back, answer));
  }, [current, answer]);

  const reveal = useCallback(() => setShown(true), []);

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

  /** 系统判定 → 预选自评档位（对→记住 / 部分→模糊 / 错→忘了 / 跳过→忘了 / 无法判定→不预选） */
  const preselect: RecallGrade | null = result
    ? result.verdict === "correct"
      ? "known"
      : result.verdict === "partial"
        ? "fuzzy"
        : result.verdict === "wrong"
          ? "forgot"
          : null
    : shown
      ? "forgot"
      : null;

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
          线上作答：系统自动比对关键点判定对错（可改判）· 1-2-4-7-15 间隔排程 · 进度存本机
        </span>
      </p>

      {phase === "setup" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            {[
              ["到期待复习", dueList.length, `复习 ${dueReviewCount} · 新卡 ${dueNewCount}`],
              ["今日已复习", todayCount, null],
              ["卡库总量", filtered.length, null],
              ["毕业卡", distribution[MAX_BOX], null],
            ].map(([k, v, sub]) => (
              <Card key={String(k)} className="p-3.5 text-center">
                <span className="text-[0.75rem] text-muted-foreground">{k}</span>
                <b className="mt-1 block text-[1.2rem]">{v}</b>
                {sub ? (
                  <span className="mt-0.5 block text-[0.7rem] text-muted-foreground">{sub}</span>
                ) : null}
              </Card>
            ))}
          </div>

          <Card className="px-(--card-spacing) mb-4 space-y-4">
            <div>
              <h2 className="mb-2 text-[1rem] font-medium">范围（总册日次 · 可多选）</h2>
              <div className="flex flex-wrap gap-1.5">
                {DAY_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() =>
                      setDaySet((s) =>
                        f.value === "all"
                          ? []
                          : s.includes(f.value)
                            ? s.filter((x) => x !== f.value)
                            : [...s, f.value]
                      )
                    }
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[0.8rem] transition-colors",
                      (f.value === "all" ? daySet.length === 0 : daySet.includes(f.value))
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
            <p className="text-[0.78rem] text-muted-foreground">
              零散时间磨耳朵？试试{" "}
              <Link href="/audio/" className="underline underline-offset-2 hover:text-foreground">
                知识点洗脑音频
              </Link>
              （语音循环播放闪卡）
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
          {result || shown ? (
            <>
              {result && result.verdict !== "manual" && (
                <div
                  className={cn(
                    "mb-3 flex items-center gap-2 rounded-[12px] border p-3.5 text-[0.9rem] font-medium",
                    result.verdict === "correct" &&
                      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    result.verdict === "partial" &&
                      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    result.verdict === "wrong" &&
                      "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  )}
                >
                  {result.verdict === "correct" ? (
                    <CheckCircle2 className="size-4.5 shrink-0" />
                  ) : (
                    <XCircle className="size-4.5 shrink-0" />
                  )}
                  <span>
                    {result.verdict === "correct"
                      ? result.hits === result.total
                        ? "判定正确 · 关键点全命中 · 建议按「记住」记"
                        : `判定正确（关键点 ${result.hits}/${result.total}）· 达标通过，缺失词见下方 ✗ · 建议按「记住」记`
                      : result.verdict === "partial"
                        ? `部分命中（关键点 ${result.hits}/${result.total}）· 建议按「模糊」记`
                        : `判定未通过（关键点 ${result.hits}/${result.total}）· 建议按「忘了」重学`}
                  </span>
                </div>
              )}
              {result && result.verdict === "manual" && (
                <div className="mb-3 flex items-center gap-2 rounded-[12px] border border-border bg-muted/40 p-3.5 text-[0.9rem] text-muted-foreground">
                  <TriangleAlert className="size-4.5 shrink-0" />
                  <span>该卡无可自动比对的关键点（如公式/图形题），请对照答案自评</span>
                </div>
              )}
              {result && (result.hitTokens.length > 0 || result.missTokens.length > 0) && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {result.hitTokens.map((t) => (
                    <span
                      key={`hit-${t}`}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.78rem] text-emerald-700 dark:text-emerald-300"
                    >
                      ✓ {t}
                    </span>
                  ))}
                  {result.missTokens.map((t) => (
                    <span
                      key={`miss-${t}`}
                      className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[0.78rem] text-rose-700 dark:text-rose-300"
                    >
                      ✗ {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="mb-5 rounded-[12px] border border-emerald-500/40 bg-emerald-500/10 p-5 text-[1rem] leading-[1.75] whitespace-pre-wrap break-words">
                {current.back}
              </div>
              <p className="mb-2.5 text-[0.82rem] text-muted-foreground">
                {result && result.verdict !== "manual"
                  ? "系统已按判定预选，如判定与你实际掌握不符，可改判后确认："
                  : "对照答案，诚实自评："}
              </p>
              <div className="btn-row">
                <Button
                  type="button"
                  variant={preselect === "forgot" ? "default" : "outline"}
                  onClick={() => grade("forgot")}
                >
                  忘了（回 1 盒）
                </Button>
                <Button
                  type="button"
                  variant={preselect === "fuzzy" ? "default" : "outline"}
                  onClick={() => grade("fuzzy")}
                >
                  模糊（原地）
                </Button>
                <Button
                  type="button"
                  variant={preselect === "known" ? "default" : "outline"}
                  onClick={() => grade("known")}
                >
                  记住（升盒）
                </Button>
              </div>
            </>
          ) : (
            <div className="mb-6">
              <textarea
                ref={answerRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={3}
                placeholder="在此默写答案（命中关键点即可，不必逐字一致）…"
                className="w-full resize-y rounded-[12px] border border-border bg-background p-4 text-[0.95rem] leading-relaxed outline-none focus:ring-2 focus:ring-ring/40"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="default"
                  onClick={submit}
                  disabled={!answer.trim()}
                  className="gap-1.5"
                >
                  <Send className="size-4" />
                  提交答案（自动比对）
                </Button>
                <button
                  type="button"
                  onClick={reveal}
                  className="text-[0.82rem] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  想不起来，直接看答案（按「忘了」记）
                </button>
              </div>
              <p className="mt-2 text-[0.78rem] text-muted-foreground">
                Enter 提交 · Shift+Enter 换行
              </p>
            </div>
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
            系统判定仅按关键点命中预选档位，改判权始终在你手上。明天再来时，到期卡会优先出现。今日已复习 <b className="text-foreground">{todayCount}</b> 张。
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