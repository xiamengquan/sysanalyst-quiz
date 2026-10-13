"use client";

/**
 * 答题轨道 · Duolingo 式背诵（v0.10.29+）
 * 四域课程（需求工程 / Web / 数据库 / 微服务，对齐案例出题重心）：
 * 单元路径 → 逐题即时反馈 → 错题当课重入直到答对 → 首过率进度环 → 单元收官打配套仿真案例。
 * 错题知识点自动转卡进 /recall（RecallApp 读取本 STORAGE_KEY 合成轨道卡）。
 * 数据：public/data/tracks.json（npm run build:tracks 由 content/tracks/*.json 构建）
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Flame,
  RotateCcw,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import { storageGet, storageSet } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TrackPoint = {
  id: string;
  title: string;
  core: string;
  vs: string;
  hook: string;
  choice: { q: string; options: string[]; answer: number; explain: string }[];
  fill: { q: string; blanks: string[][]; explain: string }[];
};

type TrackUnit = { id: string; title: string; points: TrackPoint[] };
type TrackCourse = {
  id: string;
  title: string;
  tagline: string;
  day: string;
  caseSet: { id: string; title: string; href: string; qmap: Record<string, string[]> };
  units: TrackUnit[];
};
type TracksData = { meta: { builtAt: string; courses: number; units: number; points: number; choice: number; fill: number }; courses: TrackCourse[] };

type ChoiceItem = { kind: "choice"; pid: string; ptitle: string; q: string; options: string[]; answer: number; explain: string };
type FillItem = { kind: "fill"; pid: string; ptitle: string; q: string; blanks: string[][]; explain: string };
type LessonItem = ChoiceItem | FillItem;

type PointRecord = { right: number; wrong: number; firstTry: boolean; lastAt: number };
type LessonRecord = { runs: number; best: number; at: number };
type TrackRecord = { points: Record<string, PointRecord>; lessons: Record<string, LessonRecord> };

const STORAGE_KEY = "sysanalyst_track_v1";

const DAY_LABEL: Record<string, string> = { d2: "总册 D2", d3: "总册 D3", d4: "总册 D4" };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s: string) =>
  s.trim().toLowerCase().replace(/[\s，,。.；;：:、!！?？'"「」『』（）()【】\-_/]/g, "");

function judgeBlank(input: string, aliases: string[]): boolean {
  const ni = norm(input);
  if (!ni) return false;
  return aliases.some((a) => {
    const na = norm(a);
    if (!na) return false;
    return na === ni || (ni.length >= 2 && (na.includes(ni) || ni.includes(na)));
  });
}

function Ring({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const done = Math.max(0, Math.min(1, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={5} className="stroke-border" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${(c * done).toFixed(2)} ${c.toFixed(2)}`}
        className={done >= 1 ? "stroke-green-500" : done > 0 ? "stroke-foreground" : "stroke-transparent"}
      />
    </svg>
  );
}

export function TrackApp() {
  const [data, setData] = useState<TracksData | null>(null);
  const [record, setRecord] = useState<TrackRecord>({ points: {}, lessons: {} });
  const [ready, setReady] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [unit, setUnit] = useState<TrackUnit | null>(null);
  const [queue, setQueue] = useState<LessonItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [fillInputs, setFillInputs] = useState<string[]>([]);
  const [fillChecked, setFillChecked] = useState<boolean[] | null>(null);
  const [firstSeen, setFirstSeen] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [firstPass, setFirstPass] = useState({ right: 0, total: 0 });
  const [phase, setPhase] = useState<"map" | "lesson" | "done">("map");
  const [wrongPoints, setWrongPoints] = useState<TrackPoint[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/data/tracks.json").then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }),
      storageGet<TrackRecord>(STORAGE_KEY),
    ])
      .then(([d, s]) => {
        setData(d);
        if (s && typeof s === "object" && s.points) setRecord(s);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  const persist = useCallback((next: TrackRecord) => {
    setRecord(next);
    void storageSet(STORAGE_KEY, next);
  }, []);

  const course = useMemo(() => data?.courses.find((c) => c.id === courseId) ?? null, [data, courseId]);

  const courseStats = useCallback(
    (c: TrackCourse) => {
      const pts = c.units.flatMap((u) => u.points);
      const mastered = pts.filter((p) => record.points[p.id]?.firstTry).length;
      return { total: pts.length, mastered };
    },
    [record]
  );

  const unitStats = useCallback(
    (u: TrackUnit) => {
      const mastered = u.points.filter((p) => record.points[p.id]?.firstTry).length;
      return { total: u.points.length, mastered };
    },
    [record]
  );

  const startLesson = useCallback((u: TrackUnit) => {
    const items: LessonItem[] = shuffle(
      u.points.flatMap((p) => [
        ...(p.choice ?? []).map((c) => ({ kind: "choice" as const, pid: p.id, ptitle: p.title, ...c })),
        ...(p.fill ?? []).map((f) => ({ kind: "fill" as const, pid: p.id, ptitle: p.title, ...f })),
      ])
    );
    setUnit(u);
    setQueue(items);
    setIdx(0);
    setPicked(null);
    setFillInputs([]);
    setFillChecked(null);
    setFirstSeen(new Set());
    setStreak(0);
    setMaxStreak(0);
    setFirstPass({ right: 0, total: items.length });
    setWrongPoints([]);
    setPhase("lesson");
  }, []);

  const applyJudgment = useCallback(
    (pid: string, ok: boolean, isFirstEncounter: boolean) => {
      if (isFirstEncounter) {
        const prev = record.points[pid] ?? { right: 0, wrong: 0, firstTry: false, lastAt: 0 };
        const nextRec: TrackRecord = {
          ...record,
          points: {
            ...record.points,
            [pid]: {
              right: prev.right + (ok ? 1 : 0),
              wrong: prev.wrong + (ok ? 0 : 1),
              firstTry: prev.firstTry || ok,
              lastAt: Date.now(),
            },
          },
        };
        persist(nextRec);
      }
      if (ok) {
        setStreak((s) => {
          const n = s + 1;
          setMaxStreak((m) => Math.max(m, n));
          return n;
        });
      } else {
        setStreak(0);
      }
    },
    [record, persist]
  );

  const current = queue[idx] ?? null;
  const lessonDone = phase === "lesson" && queue.length > 0 && idx >= queue.length;

  // 收官：写入 lesson 记录 + 汇总错题点
  useEffect(() => {
    if (!lessonDone || !unit) return;
    const wrongPids = [...firstSeen].length
      ? unit.points.filter((p) => {
          const rec = record.points[p.id];
          return rec && rec.wrong > 0 && !rec.firstTry;
        })
      : [];
    setWrongPoints(wrongPids);
    const best = Math.round((firstPass.right / Math.max(1, firstPass.total)) * 100);
    const nextRec: TrackRecord = {
      ...record,
      lessons: {
        ...record.lessons,
        [unit.id]: { runs: (record.lessons[unit.id]?.runs ?? 0) + 1, best, at: Date.now() },
      },
    };
    persist(nextRec);
    setPhase("done");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonDone]);

  const submitChoice = (i: number) => {
    if (picked !== null || !current || current.kind !== "choice") return;
    setPicked(i);
    const ok = i === current.answer;
    const key = `${current.pid}:c:${current.q}`;
    const first = !firstSeen.has(key);
    if (first) setFirstSeen((s) => new Set(s).add(key));
    if (first) setFirstPass((f) => ({ ...f, right: f.right + (ok ? 1 : 0) }));
    applyJudgment(current.pid, ok, first);
    if (!ok) setQueue((q) => [...q, current]); // 错题当课重入
  };

  const submitFill = () => {
    if (!current || current.kind !== "fill" || fillChecked) return;
    const results = current.blanks.map((aliases, i) => judgeBlank(fillInputs[i] ?? "", aliases));
    setFillChecked(results);
    const ok = results.every(Boolean);
    const key = `${current.pid}:f:${current.q}`;
    const first = !firstSeen.has(key);
    if (first) setFirstSeen((s) => new Set(s).add(key));
    if (first) setFirstPass((f) => ({ ...f, right: f.right + (ok ? 1 : 0) }));
    applyJudgment(current.pid, ok, first);
    if (!ok) setQueue((q) => [...q, current]);
  };

  const next = () => {
    setIdx((i) => i + 1);
    setPicked(null);
    setFillInputs([]);
    setFillChecked(null);
  };

  if (!ready) {
    return <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">加载中…</div>;
  }
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">
        轨道数据加载失败，请刷新重试。
      </div>
    );
  }

  // ---------- 课程地图 ----------
  if (phase === "map" || !course) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:pb-12">
        <header className="mb-5">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">答题轨道</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            四域课程 · 选择 + 填空 · 即时反馈 · 错题重入直到答对 · 错题点自动进 /recall
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            排程建议：碎片背诵时段（工位 / 地铁）打lesson；单元收官后打配套仿真案例题。
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.courses.map((c) => {
            const st = courseStats(c);
            const unitsDone = c.units.filter((u) => record.lessons[u.id]).length;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Ring pct={st.mastered / st.total} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold">{c.title}</h2>
                      <span className="rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                        {DAY_LABEL[c.day] ?? c.day}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.tagline}</p>
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      知识点 {st.mastered}/{st.total} 首过 · 单元已练 {unitsDone}/{c.units.length}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {c.units.map((u) => {
                    const us = unitStats(u);
                    const best = record.lessons[u.id]?.best ?? 0;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          setCourseId(c.id);
                          startLesson(u);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-left text-sm transition-colors",
                          "hover:border-foreground/30 hover:bg-muted/40"
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {u.title}
                          <span className="ml-1 text-[0.65rem] text-muted-foreground">{us.mastered}/{us.total}</span>
                        </span>
                        <span className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                          {best > 0 ? <span className="text-amber-600 dark:text-amber-400">最佳 {best}%</span> : null}
                          <span className={cn(best >= 100 ? "text-green-600 dark:text-green-400" : "")}>
                            {best >= 100 ? "已通关" : "开练"}
                          </span>
                          <ArrowRight className="size-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <Link href={c.caseSet.href}>
                    <BookOpen className="size-3.5" /> 收官配套仿真案例：{c.caseSet.id}
                  </Link>
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- Lesson 播放器 ----------
  if (phase === "lesson" && current) {
    const progress = firstPass.total ? (idx / queue.length) * 100 : 0;
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 sm:pb-12">
        <div className="mb-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPhase("map")} className="gap-1 px-2">
            <ArrowLeft className="size-4" /> 退出
          </Button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Flame className={cn("size-3.5", streak > 0 && "text-amber-500")} />
            {streak}
          </span>
        </div>
        <div className="mb-2 text-xs text-muted-foreground">
          {course.title} · {unit?.title} · 知识点「{current.ptitle}」
        </div>
        <Card className="p-4 sm:p-5">
          <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            {current.kind === "choice" ? "选择题" : "填空题"}
          </p>
          <p className="mt-1.5 text-base font-medium leading-relaxed">{current.q}</p>

          {current.kind === "choice" ? (
            <div className="mt-4 grid gap-2">
              {current.options.map((opt, i) => {
                const isAnswer = i === current.answer;
                const isPicked = i === picked;
                return (
                  <button
                    key={i}
                    disabled={picked !== null}
                    onClick={() => submitChoice(i)}
                    className={cn(
                      "rounded-lg border border-border/70 px-3.5 py-2.5 text-left text-sm transition-colors",
                      picked === null && "hover:border-foreground/40 hover:bg-muted/40",
                      picked !== null && isAnswer && "border-green-500/60 bg-green-500/10",
                      picked !== null && isPicked && !isAnswer && "border-red-500/60 bg-red-500/10",
                      picked !== null && !isPicked && !isAnswer && "opacity-60"
                    )}
                  >
                    <span className="mr-2 text-xs text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {current.blanks.map((aliases, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs text-muted-foreground">空 {i + 1}</span>
                  <input
                    value={fillInputs[i] ?? ""}
                    disabled={fillChecked !== null}
                    onChange={(e) => {
                      const nextInputs = [...fillInputs];
                      nextInputs[i] = e.target.value;
                      setFillInputs(nextInputs);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitFill();
                    }}
                    placeholder="输入你的答案"
                    className={cn(
                      "h-10 w-full min-w-0 rounded-lg border border-border/70 bg-background px-3 text-sm outline-none transition-colors",
                      "focus:border-foreground/40",
                      fillChecked !== null && fillChecked[i] && "border-green-500/60 bg-green-500/10",
                      fillChecked !== null && !fillChecked[i] && "border-red-500/60 bg-red-500/10"
                    )}
                  />
                  {fillChecked !== null && !fillChecked[i] ? (
                    <span className="shrink-0 text-xs text-green-600 dark:text-green-400">
                      应填：{aliases.join(" / ")}
                    </span>
                  ) : null}
                </div>
              ))}
              {fillChecked === null ? (
                <Button size="sm" onClick={submitFill} className="mt-1">
                  检查 <Target className="size-3.5" />
                </Button>
              ) : null}
            </div>
          )}

          {picked !== null || fillChecked !== null ? (
            <div
              className={cn(
                "mt-4 rounded-lg border p-3 text-sm leading-relaxed",
                (current.kind === "choice" ? picked === current.answer : fillChecked?.every(Boolean))
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-red-500/50 bg-red-500/10"
              )}
            >
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                {(current.kind === "choice" ? picked === current.answer : fillChecked?.every(Boolean)) ? (
                  <>
                    <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" /> 答对了
                  </>
                ) : (
                  <>
                    <XCircle className="size-4 text-red-600 dark:text-red-400" /> 再记一遍（本题稍后重入）
                  </>
                )}
              </div>
              <p className="text-muted-foreground">{current.explain}</p>
              {current.kind === "fill" && fillChecked && !fillChecked.every(Boolean) ? (
                <p className="mt-1 text-muted-foreground">
                  正确答案：{current.blanks.map((b) => b[0]).join("｜")}
                </p>
              ) : null}
              <Button size="sm" onClick={next} className="mt-3">
                继续 <ArrowRight className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

  // ---------- 收官页 ----------
  const pct = Math.round((firstPass.right / Math.max(1, firstPass.total)) * 100);
  const courseIdx = data.courses.findIndex((c) => c.id === courseId);
  const nextCourse = data.courses[courseIdx + 1] ?? data.courses[0];
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-10 sm:pb-12">
      <Card className="p-6 text-center">
        <Trophy className={cn("mx-auto size-10", pct >= 100 ? "text-amber-500" : "text-muted-foreground/60")} />
        <h2 className="mt-3 text-lg font-bold">
          {pct >= 100 ? "完美通关！" : "单元完成"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {course.title} · {unit?.title}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border/70 p-3">
            <div className="text-lg font-bold">{pct}%</div>
            <div className="text-[0.65rem] text-muted-foreground">首过率</div>
          </div>
          <div className="rounded-lg border border-border/70 p-3">
            <div className="text-lg font-bold">{maxStreak}</div>
            <div className="text-[0.65rem] text-muted-foreground">最高连对</div>
          </div>
          <div className="rounded-lg border border-border/70 p-3">
            <div className="text-lg font-bold">{firstPass.right}/{firstPass.total}</div>
            <div className="text-[0.65rem] text-muted-foreground">题（首遇）</div>
          </div>
        </div>
        {wrongPoints.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-left text-sm">
            <p className="font-medium">⚠ 未首过知识点（已自动转卡进 /recall）：</p>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              {wrongPoints.map((p) => (
                <li key={p.id}>{p.title}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button asChild size="sm">
            <Link href={course.caseSet.href}>
              <BookOpen className="size-3.5" /> 打配套仿真案例（{course.caseSet.id}）
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => unit && startLesson(unit)}>
            <RotateCcw className="size-3.5" /> 再练一遍本单元
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPhase("map")}>
            回课程地图
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setCourseId(nextCourse.id); setPhase("map"); }}>
            下一门：{nextCourse.title}
          </Button>
        </div>
      </Card>
    </div>
  );
}
