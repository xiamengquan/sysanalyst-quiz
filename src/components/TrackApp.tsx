"use client";

/**
 * 答题轨道 · Duolingo 式背诵（v0.10.29+）
 * 四域课程（需求工程 / Web / 数据库 / 微服务，对齐案例出题重心）：
 * 单元路径 → 逐题即时反馈 → 错题当课重入直到答对 → 首过率进度环 → 单元收官打配套仿真案例。
 * 错题知识点自动转卡进 /recall（RecallApp 读取本 STORAGE_KEY 合成轨道卡）。
 * 数据：public/data/tracks.json（npm run build:tracks 由 content/tracks/*.json 构建）
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  Flame,
  RotateCcw,
  Target,
  Trophy,
  XCircle,
  Zap,
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
  short: { q: string; reference: string }[];
  bool: { q: string; answer: boolean; explain: string }[];
  match: { title: string; pairs: [string, string][]; explain: string }[];
  order: { title: string; steps: string[]; explain: string }[];
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
type ShortItem = { kind: "short"; pid: string; ptitle: string; q: string; reference: string };
type BoolItem = { kind: "bool"; pid: string; ptitle: string; q: string; answer: boolean; explain: string };
type MatchItem = { kind: "match"; pid: string; ptitle: string; title: string; pairs: [string, string][]; explain: string };
type OrderItem = { kind: "order"; pid: string; ptitle: string; title: string; steps: string[]; explain: string };
type LessonItem = ChoiceItem | FillItem | ShortItem | BoolItem | MatchItem | OrderItem;

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

/** 确定性打乱索引（seed 控制稳定）：同一题重渲染不重排，且保证结果 ≠ 原序 */
function shuffleIdx(n: number, seed: string): number[] {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  if (n > 1 && idx.every((v, i) => v === i)) [idx[0], idx[1]] = [idx[1], idx[0]];
  return idx;
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

/** ⚡ 冲击模式题数：choice+bool+fill（不含简答/配对/排序） */
function barrageCount(c: TrackCourse): number {
  return c.units.reduce(
    (n, u) =>
      n +
      u.points.reduce(
        (m, p) => m + (p.choice?.length ?? 0) + (p.bool?.length ?? 0) + (p.fill?.length ?? 0),
        0
      ),
    0
  );
}

export function TrackApp() {
  const [data, setData] = useState<TracksData | null>(null);
  const [record, setRecord] = useState<TrackRecord>({ points: {}, lessons: {} });
  const [ready, setReady] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [unit, setUnit] = useState<TrackUnit | null>(null);
  const [barrage, setBarrage] = useState(false);
  const [queue, setQueue] = useState<LessonItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [fillInputs, setFillInputs] = useState<string[]>([]);
  const [fillChecked, setFillChecked] = useState<boolean[] | null>(null);
  const [shortDraft, setShortDraft] = useState("");
  const [shortRevealed, setShortRevealed] = useState(false);
  const [shortJudged, setShortJudged] = useState<boolean | null>(null);
  const [boolPicked, setBoolPicked] = useState<boolean | null>(null);
  const [matchSel, setMatchSel] = useState<number | null>(null); // 左列选中项（显示序）
  const [matchPairs, setMatchPairs] = useState<Record<number, number>>({}); // 左显示序 → 右显示序
  const [matchWrong, setMatchWrong] = useState<{ side: "l" | "r"; idx: number } | null>(null);
  const [matchErrors, setMatchErrors] = useState(0);
  const [matchDone, setMatchDone] = useState(false);
  const [orderSeq, setOrderSeq] = useState<number[]>([]); // 候选显示序组成的答案序列
  const [orderDone, setOrderDone] = useState(false);
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

  // 深链：/track/?point=<pid> 或 /track/?course=<cid> —— 总控台风险项/矩阵点格直达
  useEffect(() => {
    if (!ready || !data) return;
    const q = new URLSearchParams(window.location.search);
    const point = q.get("point");
    const cid = q.get("course");
    if (!point && !cid) return;
    let target: typeof data.courses[number] | null = cid ? data.courses.find((c) => c.id === cid) ?? null : null;
    let unitId: string | null = null;
    if (point && !target) {
      for (const c of data.courses) {
        const u = c.units.find((u) => u.points.some((p) => p.id === point));
        if (u) {
          target = c;
          unitId = u.id;
          break;
        }
      }
    } else if (point && target) {
      const u = target.units.find((u) => u.points.some((p) => p.id === point));
      if (u) unitId = u.id;
    }
    if (!target) return;
    setCourseId(target.id);
    const t = window.setTimeout(() => {
      const el = unitId ? document.getElementById(`unit-${unitId}`) : document.getElementById(`course-${target!.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [ready, data]);

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
        ...(p.bool ?? []).map((b) => ({ kind: "bool" as const, pid: p.id, ptitle: p.title, ...b })),
        ...(p.fill ?? []).map((f) => ({ kind: "fill" as const, pid: p.id, ptitle: p.title, ...f })),
        ...(p.match ?? []).map((m) => ({ kind: "match" as const, pid: p.id, ptitle: p.title, ...m })),
        ...(p.order ?? []).map((o) => ({ kind: "order" as const, pid: p.id, ptitle: p.title, ...o })),
        ...(p.short ?? []).map((s) => ({ kind: "short" as const, pid: p.id, ptitle: p.title, ...s })),
      ])
    );
    setBarrage(false);
    beginSession(items, u);
  }, []);

  /** ⚡ 冲击模式：全课程按知识点连击（choice/bool/fill 连续题流），错题不重入不打断，错点自动进 /recall 排程 */
  const startBarrage = useCallback((c: TrackCourse) => {
    const items: LessonItem[] = c.units.flatMap((u) =>
      u.points.flatMap((p) => {
        const pick = <T,>(arr: T[]) => shuffle(arr);
        return [
          ...pick(p.choice ?? []).map((x) => ({ kind: "choice" as const, pid: p.id, ptitle: p.title, ...x })),
          ...pick(p.bool ?? []).map((x) => ({ kind: "bool" as const, pid: p.id, ptitle: p.title, ...x })),
          ...pick(p.fill ?? []).map((x) => ({ kind: "fill" as const, pid: p.id, ptitle: p.title, ...x })),
        ];
      })
    );
    setBarrage(true);
    beginSession(items, null);
  }, []);

  const beginSession = (items: LessonItem[], u: TrackUnit | null) => {
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
  };

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

  // 收官：写入 lesson 记录 + 汇总错题点（冲击模式只切收官页，不写单元记录）
  const barrageRef = useRef(barrage);
  useEffect(() => {
    barrageRef.current = barrage;
  }, [barrage]);
  useEffect(() => {
    if (!lessonDone) return;
    if (barrageRef.current || !unit) {
      setWrongPoints([]);
      setPhase("done");
      return;
    }
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
    if (!ok && !barrage) setQueue((q) => [...q, current]); // 错题当课重入（冲击模式不重入，保持连续）
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
    if (!ok && !barrage) setQueue((q) => [...q, current]);
  };

  // 简答题（自评式）：先自己作答（草稿不判分）→ 揭晓参考答案 → 自评「答到了 / 没答到」
  const submitShort = (ok: boolean) => {
    if (!current || current.kind !== "short" || shortJudged !== null) return;
    setShortJudged(ok);
    const key = `${current.pid}:s:${current.q}`;
    const first = !firstSeen.has(key);
    if (first) setFirstSeen((s) => new Set(s).add(key));
    if (first) setFirstPass((f) => ({ ...f, right: f.right + (ok ? 1 : 0) }));
    applyJudgment(current.pid, ok, first);
    if (!ok && !barrage) setQueue((q) => [...q, current]);
  };

  // 判断题：对 / 错 二选一
  const submitBool = (v: boolean) => {
    if (!current || current.kind !== "bool" || boolPicked !== null) return;
    setBoolPicked(v);
    const ok = v === current.answer;
    const key = `${current.pid}:b:${current.q}`;
    const first = !firstSeen.has(key);
    if (first) setFirstSeen((s) => new Set(s).add(key));
    if (first) setFirstPass((f) => ({ ...f, right: f.right + (ok ? 1 : 0) }));
    applyJudgment(current.pid, ok, first);
    if (!ok && !barrage) setQueue((q) => [...q, current]);
  };

  // 配对题：左列选中 → 点右列配对；配错闪红计数不建立配对；全部配对完成自动判定（零配错=过）
  const matchLeft = useMemo(() => (current?.kind === "match" ? shuffleIdx(current.pairs.length, current.title + "l") : []), [current]);
  const matchRight = useMemo(() => (current?.kind === "match" ? shuffleIdx(current.pairs.length, current.title + "r") : []), [current]);

  const tryMatch = (rightShowIdx: number) => {
    if (!current || current.kind !== "match" || matchDone) return;
    if (matchSel === null) {
      setMatchWrong({ side: "r", idx: rightShowIdx });
      setTimeout(() => setMatchWrong(null), 450);
      return;
    }
    const leftOrig = matchLeft[matchSel];
    const rightOrig = matchRight[rightShowIdx];
    if (leftOrig === rightOrig) {
      const done = { ...matchPairs, [matchSel]: rightShowIdx };
      setMatchPairs(done);
      setMatchSel(null);
      if (Object.keys(done).length === current.pairs.length) finishMatch();
    } else {
      setMatchErrors((e) => e + 1);
      setMatchWrong({ side: "r", idx: rightShowIdx });
      setTimeout(() => setMatchWrong(null), 450);
    }
  };

  const finishMatch = () => {
    if (!current || current.kind !== "match") return;
    setMatchDone(true);
    const ok = matchErrors === 0;
    const key = `${current.pid}:m:${current.title}`;
    const first = !firstSeen.has(key);
    if (first) setFirstSeen((s) => new Set(s).add(key));
    if (first) setFirstPass((f) => ({ ...f, right: f.right + (ok ? 1 : 0) }));
    applyJudgment(current.pid, ok, first);
    if (!ok) setQueue((q) => [...q, current]);
  };

  // 排序题：按正确顺序点击候选 chips 组成序列，提交判定
  const orderPool = useMemo(() => (current?.kind === "order" ? shuffleIdx(current.steps.length, current.title) : []), [current]);

  const submitOrder = () => {
    if (!current || current.kind !== "order" || orderDone) return;
    // 修复：orderSeq 存的是显示序，须经 orderPool 映射回原始下标再取标签文本比较（此前误比下标 vs 文本，恒判错）
    const ok = orderSeq.map((i) => current.steps[orderPool[i]]).join("|") === current.steps.join("|");
    setOrderDone(true);
    const key = `${current.pid}:o:${current.title}`;
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
    setShortDraft("");
    setShortRevealed(false);
    setShortJudged(null);
    setBoolPicked(null);
    setMatchSel(null);
    setMatchPairs({});
    setMatchWrong(null);
    setMatchErrors(0);
    setMatchDone(false);
    setOrderSeq([]);
    setOrderDone(false);
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
            四域课程 · 选择/填空/判断/配对/排序/简答六题型 · 即时反馈 · 错题重入直到答对 · 错题点自动进 /recall
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
              <Card key={c.id} className="p-4" id={`course-${c.id}`}>
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
                        id={`unit-${u.id}`}
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
                <Button
                  variant="default"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    setCourseId(c.id);
                    startBarrage(c);
                  }}
                >
                  <Zap className="size-3.5" />
                  ⚡ 连续冲击 · {barrageCount(c)} 题一杆到底（不含简答）
                </Button>
                <Button asChild variant="outline" size="sm" className="mt-2 w-full">
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
    const kindLabel = ({ choice: "选择题", fill: "填空题", short: "简答题", bool: "判断题", match: "配对题", order: "排序题" } as const)[current.kind];
    const kbAnchorMap: Record<string, string> = {
      req: "/kb/quick-four-tier-7d/#d2",
      web: "/kb/quick-four-tier-7d/#d3",
      mic: "/kb/quick-four-tier-7d/#d3",
      db: "/kb/quick-four-tier-7d/#d4",
      mod: "/kb/quick-four-tier-7d/#d1",
    };
    const kbAnchor = kbAnchorMap[current.pid.replace(/-p\d+$/, "")] ?? "";
    const genericJudged =
      current.kind === "choice" ? picked !== null
      : current.kind === "fill" ? fillChecked !== null
      : current.kind === "bool" ? boolPicked !== null
      : current.kind === "match" ? matchDone
      : current.kind === "order" ? orderDone
      : false;
    const genericOk =
      current.kind === "choice" ? picked === current.answer
      : current.kind === "fill" ? (fillChecked?.every(Boolean) ?? false)
      : current.kind === "bool" ? boolPicked === current.answer
      : current.kind === "match" ? matchErrors === 0
      : current.kind === "order" ? orderSeq.map((i) => current.steps[orderPool[i]]).join("|") === current.steps.join("|")
      : false;
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
          {barrage
            ? "⚡ 连续冲击模式 · 错题不重入，错点自动进 /recall 排程"
            : `${course.title} · ${unit?.title ?? ""} · 知识点「${current.ptitle}」`}
        </div>
        <Card className="p-4 sm:p-5">
          <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            {kindLabel}
          </p>
          <p className="mt-1.5 text-base font-medium leading-relaxed">
            {current.kind === "match" || current.kind === "order" ? current.title : current.q}
          </p>

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
          ) : current.kind === "bool" ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[true, false].map((v) => {
                const isAnswer = v === current.answer;
                const isPicked = boolPicked === v;
                return (
                  <button
                    key={String(v)}
                    disabled={boolPicked !== null}
                    onClick={() => submitBool(v)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border border-border/70 px-3.5 py-3 text-sm font-medium transition-colors",
                      boolPicked === null && "hover:border-foreground/40 hover:bg-muted/40",
                      boolPicked !== null && isAnswer && "border-green-500/60 bg-green-500/10",
                      boolPicked !== null && isPicked && !isAnswer && "border-red-500/60 bg-red-500/10",
                      boolPicked !== null && !isPicked && !isAnswer && "opacity-60"
                    )}
                  >
                    {v ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                    {v ? "对" : "错"}
                  </button>
                );
              })}
            </div>
          ) : current.kind === "fill" ? (
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
          ) : current.kind === "short" ? (
            <div className="mt-4 space-y-3">
              <textarea
                value={shortDraft}
                disabled={shortRevealed}
                onChange={(e) => setShortDraft(e.target.value)}
                placeholder="先自己在纸上或这里作答（可选，不作判分依据），再看参考答案自评"
                rows={4}
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40"
              />
              {shortRevealed ? (
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">参考作答要点（非唯一答案）</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{current.reference}</p>
                </div>
              ) : null}
              {!shortRevealed ? (
                <Button size="sm" onClick={() => setShortRevealed(true)}>
                  看参考答案 <Eye className="size-3.5" />
                </Button>
              ) : shortJudged === null ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => submitShort(true)} className="border-green-500/60 hover:bg-green-500/10">
                    <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400" /> 答到了
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => submitShort(false)} className="border-red-500/60 hover:bg-red-500/10">
                    <XCircle className="size-3.5 text-red-600 dark:text-red-400" /> 没答到（本题重入）
                  </Button>
                </div>
              ) : null}
            </div>
          ) : current.kind === "match" ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                点左列术语选中，再点右列对应含义；配错会计数闪红，{current.pairs.length} 对全部配对完成后自动判定（零配错才算过）。
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  {matchLeft.map((orig, show) => {
                    const matched = matchPairs[show] !== undefined;
                    return (
                      <button
                        key={orig}
                        disabled={matched || matchDone}
                        onClick={() => setMatchSel(matchSel === show ? null : show)}
                        className={cn(
                          "w-full rounded-lg border border-border/70 px-2.5 py-2 text-left text-[0.82rem] leading-snug transition-colors",
                          "focus:border-foreground/40",
                          matched && "border-green-500/60 bg-green-500/10 opacity-50",
                          !matched && matchSel === show && "border-primary bg-primary/10 font-medium",
                          !matched && matchSel !== show && "hover:border-foreground/40 hover:bg-muted/40"
                        )}
                      >
                        {current.pairs[orig][0]}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  {matchRight.map((orig, show) => {
                    const matched = Object.values(matchPairs).includes(show);
                    const flashWrong = matchWrong?.side === "r" && matchWrong.idx === show;
                    return (
                      <button
                        key={orig}
                        disabled={matched || matchDone}
                        onClick={() => tryMatch(show)}
                        className={cn(
                          "w-full rounded-lg border border-border/70 px-2.5 py-2 text-left text-[0.82rem] leading-snug transition-colors",
                          matched && "border-green-500/60 bg-green-500/10 opacity-50",
                          !matched && flashWrong && "border-red-500/60 bg-red-500/10",
                          !matched && !flashWrong && "hover:border-foreground/40 hover:bg-muted/40"
                        )}
                      >
                        {current.pairs[orig][1]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : current.kind === "order" ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                按正确顺序点击下方步骤组成答案（点答案中的步骤可撤回），集齐 {current.steps.length} 步后提交。
              </p>
              <div className="min-h-9 space-y-1.5">
                {orderSeq.length === 0 ? (
                  <p className="text-xs text-muted-foreground">（点击下方步骤开始作答）</p>
                ) : (
                  orderSeq.map((show, i) => (
                    <button
                      key={i}
                      disabled={orderDone}
                      onClick={() => setOrderSeq(orderSeq.filter((_, k) => k !== i))}
                      className="flex w-full items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-left text-sm hover:border-foreground/40"
                    >
                      <span className="shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                      {current.steps[orderPool[show]]}
                    </button>
                  ))
                )}
              </div>
              {!orderDone ? (
                <div className="flex flex-wrap gap-1.5">
                  {orderPool.map((orig, show) =>
                    orderSeq.includes(show) ? null : (
                      <button
                        key={orig}
                        onClick={() => setOrderSeq([...orderSeq, show])}
                        className="rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-[0.82rem] transition-colors hover:border-foreground/40 hover:bg-muted/40"
                      >
                        {current.steps[orig]}
                      </button>
                    )
                  )}
                </div>
              ) : null}
              {!orderDone ? (
                <Button size="sm" disabled={orderSeq.length !== current.steps.length} onClick={submitOrder} className={cn(orderSeq.length !== current.steps.length && "opacity-40")}>
                  提交顺序 <Target className="size-3.5" />
                </Button>
              ) : null}
            </div>
          ) : null}

          {current.kind === "short" ? (
            shortJudged !== null ? (
              <div
                className={cn(
                  "mt-4 rounded-lg border p-3 text-sm leading-relaxed",
                  shortJudged ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"
                )}
              >
                <div className="mb-1 flex items-center gap-1.5 font-semibold">
                  {shortJudged ? (
                    <>
                      <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" /> 自评：答到了
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4 text-red-600 dark:text-red-400" /> 自评：没答到（本题稍后重入）
                    </>
                  )}
                </div>
                <p className="text-muted-foreground">
                  简答题以自评为准：能对着参考要点复述出采分点，就算过关。没答到的题会在本轮稍后重新出现。
                  {kbAnchor ? (
                    <>
                      {" "}
                      <Link href={kbAnchor} className="underline underline-offset-2">
                        📖 没答到？先回总册重学此点
                      </Link>
                    </>
                  ) : null}
                </p>
                <Button size="sm" onClick={next} className="mt-3">
                  继续 <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ) : null
          ) : genericJudged ? (
            <div
              className={cn(
                "mt-4 rounded-lg border p-3 text-sm leading-relaxed",
                genericOk ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"
              )}
            >
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                {genericOk ? (
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
              {kbAnchor ? (
                <p className="mt-1 text-[0.8rem]">
                  <Link href={kbAnchor} className="underline underline-offset-2">
                    📖 重学此点 → 总册逐点讲透（在练习中重复学习）
                  </Link>
                </p>
              ) : null}
              {current.kind === "fill" && fillChecked && !fillChecked.every(Boolean) ? (
                <p className="mt-1 text-muted-foreground">
                  正确答案：{current.blanks.map((b) => b[0]).join("｜")}
                </p>
              ) : null}
              {current.kind === "match" && !genericOk ? (
                <p className="mt-1 text-muted-foreground">配错 {matchErrors} 次。正确配对：{current.pairs.map(([l, r]) => `${l}=${r}`).join("；")}</p>
              ) : null}
              {current.kind === "order" && !genericOk ? (
                <p className="mt-1 text-muted-foreground">正确顺序：{current.steps.map((s, i) => `${i + 1}.${s}`).join(" → ")}</p>
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
          {barrage ? "⚡ 连续冲击完成！" : pct >= 100 ? "完美通关！" : "单元完成"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {barrage ? `${course.title} · 全课程 ${firstPass.total} 题连击` : `${course.title} · ${unit?.title ?? ""}`}
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
          {barrage ? (
            <Button variant="outline" size="sm" onClick={() => startBarrage(course)}>
              <Zap className="size-3.5" /> 再冲一轮
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => unit && startLesson(unit)}>
              <RotateCcw className="size-3.5" /> 再练一遍本单元
            </Button>
          )}
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
