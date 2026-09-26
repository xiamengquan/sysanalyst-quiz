"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Dices, Flame, LayoutGrid, Trophy } from "lucide-react";
import { CH_NAMES, type Question } from "@/lib/types";
import { QUIZ_STORAGE_KEY, storageGet, storageSet } from "@/lib/storage";
import { KbPreviewDrawer, useKbCatalog } from "@/components/KbPreviewDrawer";
import { RichText } from "@/components/RichText";
import { findRelatedKbForQuestion } from "@/lib/quiz-kb";
import type { KbSearchDoc, KbSearchIndex } from "@/lib/kb-search";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dialogMobileSheetClassName } from "@/lib/dialog-mobile";
import { cn } from "@/lib/utils";
import { ExamSprintBanner } from "@/components/ExamCountdown";
import {
  EXAM_CHOICE_MAX_MINUTES,
  EXAM_CHOICE_MIN_MINUTES_BEFORE_SUBMIT,
} from "@/lib/exam-schedule";
import { parseQuizDeepLink } from "@/lib/quiz-deep-link";

type Meta = { practice: number; real: number; workshop: number; total: number };

type QuizPersist = {
  poolNos?: number[];
  idx?: number;
  answers?: Record<number, string>;
  revealed?: Record<number, boolean>;
  mode?: string;
  isRandom75Session?: boolean;
};

/** Fisher-Yates 洗牌算法，保证无偏均匀随机分布 */
function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function QuizApp() {
  const searchParams = useSearchParams();
  const appliedDeepLink = useRef(false);
  const [all, setAll] = useState<Question[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [bank, setBank] = useState("practice");
  const [yearHalf, setYearHalf] = useState("all");
  const [chapter, setChapter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [fromKbDeepLink, setFromKbDeepLink] = useState(false);
  const [diff, setDiff] = useState("all");
  const [path, setPath] = useState<
    | "all"
    | "frontend"
    | "math_easy"
    | "roi_boost"
    | "roi_stable"
    | "scenario"
    | "req_learn"
    | "sao_learn"
    | "random75"
  >("scenario");
  const [mode, setMode] = useState<"continuous" | "practice" | "exam">("continuous");
  const [limit, setLimit] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [isRandom75Session, setIsRandom75Session] = useState(false);
  const [sheetCardOpen, setSheetCardOpen] = useState(false);
  const [pool, setPool] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [phase, setPhase] = useState<"setup" | "quiz" | "result">("setup");
  const [loading, setLoading] = useState(true);
  const catalog = useKbCatalog();
  const [kbDocs, setKbDocs] = useState<KbSearchDoc[]>([]);
  const [kbOpen, setKbOpen] = useState(false);
  const [kbStack, setKbStack] = useState<{ id: string; title: string }[]>([]);
  const [kbPinned, setKbPinned] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/data/questions.json").then((r) => r.json()),
      fetch("/data/question-meta.json").then((r) => r.json()),
      fetch("/data/paper.json")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch("/data/kb-search-index.json")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([qs, m, paper, kbIdx]) => {
      const paperQs = (Array.isArray(paper) ? paper : []).map((o: Record<string, unknown>, i: number) => ({
        no: Number(o.no) || 900000 + i,
        ch: Number(o.chapter) || 22,
        point: String(o.point || "论文"),
        stem: String(o.stem || ""),
        opts: (o.options || o.opts || {}) as Record<string, string>,
        ans: String(o.answer || o.ans || ""),
        exp: String(o.explain || o.exp || ""),
        diff: String(o.difficulty || o.diff || "basic"),
        bank: "paper",
        source: String(o.source || "论文自测"),
        id: o.id ? String(o.id) : undefined,
        intensity: "boost" as const,
      }));
      setAll([...qs, ...paperQs]);
      setMeta(m);
      const docs = (kbIdx as KbSearchIndex | null)?.docs;
      setKbDocs(Array.isArray(docs) ? docs : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading || appliedDeepLink.current) return;
    appliedDeepLink.current = true;
    const link = parseQuizDeepLink(searchParams);
    if (!link.chapter && !link.q && !link.bank && !link.path) return;
    setFromKbDeepLink(true);
    if (link.bank) setBank(link.bank);
    if (link.path) setPath(link.path);
    else if (link.chapter != null) setPath("all");
    if (link.chapter != null) setChapter(String(link.chapter));
    if (link.q) setKeyword(link.q);
  }, [loading, searchParams]);

  const yearHalves = useMemo(() => {
    const s = new Set<string>();
    all
      .filter((q) => q.bank === "real" && q.year)
      .forEach((q) => s.add(`${q.year}${q.half || ""}`));
    return [...s].sort((a, b) => b.localeCompare(a, "zh"));
  }, [all]);

  const chapters = useMemo(() => {
    const s = new Set<number>();
    all.filter((q) => q.bank === "practice").forEach((q) => s.add(q.ch));
    return [...s].sort((a, b) => a - b);
  }, [all]);

  /** 综合知识纯选择题候选池（排除论文自测题） */
  const pureChoiceQuestions = useMemo(
    () => all.filter((q) => q.bank === "real" || q.bank === "practice" || q.bank === "workshop"),
    [all]
  );

  const filtered = useMemo(() => {
    const feCh = new Set([4, 7, 9, 12, 13, 14, 15]);
    let list = all.filter((q) => {
      if (path === "random75") {
        return q.bank === "real" || q.bank === "practice" || q.bank === "workshop";
      }
      if (bank === "paper") return q.bank === "paper";
      if (bank !== "all" && q.bank !== bank) return false;
      if (bank === "all" && q.bank === "paper" && path !== "roi_boost" && path !== "all") return false;
      if (bank === "real" && yearHalf !== "all") {
        const yh = `${q.year || ""}${q.half || ""}`;
        if (yh !== yearHalf) return false;
      }
      if ((bank === "practice" || bank === "all") && chapter !== "all" && String(q.ch) !== chapter) {
        if (q.bank === "paper") return path === "roi_boost" || path === "all";
        return false;
      }
      if (diff !== "all" && q.diff !== diff) return false;
      if (keyword.trim()) {
        const k = keyword.trim();
        const bag = `${q.point || ""}${q.stem}`;
        if (!bag.includes(k)) return false;
      }
      // 综合知识真题库：不受自编学习路径限制
      if (bank === "real") return true;
      if (path === "frontend") {
        const tagged = Array.isArray(q.audience) && q.audience.includes("frontend");
        if (!feCh.has(q.ch) && !tagged) return false;
      }
      if (path === "math_easy") {
        if (q.bank === "real") return true;
        if (q.ch === 2) return q.math_level === "intuition" || q.diff === "basic";
        if (feCh.has(q.ch)) return true;
        return Array.isArray(q.audience) && q.audience.includes("frontend");
      }
      if (path === "roi_boost") {
        if (q.bank === "real") return true;
        if (q.bank === "paper") return true;
        // 大分值：加练章 + 绑案例的规划/需求
        const boostCh = new Set([3, 4, 5, 7, 9, 10, 11, 12, 14]);
        if (q.intensity === "boost") return true;
        return boostCh.has(q.ch);
      }
      if (path === "roi_stable") {
        if (q.bank === "real") return true;
        const stableCh = new Set([0, 1, 2, 6, 8, 13, 15]);
        if (q.intensity === "stable") return stableCh.has(q.ch) || q.ch === 1;
        return stableCh.has(q.ch);
      }
      if (path === "scenario") {
        if (q.bank !== "practice" && q.bank !== "workshop") return false;
        return q.style_track === "scenario";
      }
      if (path === "req_learn") {
        if (q.bank !== "practice" && q.bank !== "workshop") return false;
        if (q.ch !== 11 && q.learn_path !== "req") return false;
        return true;
      }
      if (path === "sao_learn") {
        if (q.bank !== "practice" && q.bank !== "workshop") return false;
        return q.learn_path === "sao";
      }
      return true;
    });

    if (shuffle || path === "random75") {
      list = shuffleArray(list);
    } else if (path === "req_learn" || path === "sao_learn") {
      const stageRank: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
      list = [...list].sort((a, b) => {
        const ra = stageRank[String(a.learn_stage || "")] ?? 9;
        const rb = stageRank[String(b.learn_stage || "")] ?? 9;
        if (ra !== rb) return ra - rb;
        return a.no - b.no;
      });
    } else if (bank === "real") {
      // 真题：按场次 + 题号顺序（数据版卷面序）
      list = [...list].sort((a, b) => {
        const ya = `${a.year || ""}${a.half || ""}`;
        const yb = `${b.year || ""}${b.half || ""}`;
        if (ya !== yb) return yb.localeCompare(ya, "zh");
        return (a.qnum || a.no) - (b.qnum || b.no);
      });
    }

    const effectiveLimit = path === "random75" && limit === 0 ? 75 : limit;
    if (effectiveLimit > 0) list = list.slice(0, effectiveLimit);
    return list;
  }, [all, bank, yearHalf, chapter, diff, path, shuffle, limit, keyword]);

  const persist = useCallback(async () => {
    try {
      await storageSet(QUIZ_STORAGE_KEY, {
        poolNos: pool.map((q) => q.no),
        idx,
        answers,
        revealed,
        mode,
        isRandom75Session,
      });
    } catch {
      /* ignore */
    }
  }, [pool, idx, answers, revealed, mode, isRandom75Session]);

  /** 一键全题库随机抽取 75 题功能 */
  const startRandom75 = useCallback(
    async (preferredMode?: "continuous" | "practice" | "exam") => {
      if (pureChoiceQuestions.length === 0) {
        alert("题库正在加载中或无可用题目，请稍候…");
        return;
      }
      // 使用 Fisher-Yates 算法无偏洗牌后截取前 75 题
      const selected = shuffleArray(pureChoiceQuestions).slice(
        0,
        Math.min(75, pureChoiceQuestions.length)
      );
      setPool(selected);
      setIdx(0);
      setAnswers({});
      setRevealed({});
      setIsRandom75Session(true);
      if (preferredMode) setMode(preferredMode);
      setPhase("quiz");
    },
    [pureChoiceQuestions]
  );

  const start = useCallback(
    async (opts?: { fromWrong?: boolean; resume?: boolean; isRandom75?: boolean }) => {
      let list = filtered;
      let sessionRandom75 = opts?.isRandom75 ?? (path === "random75");
      if (opts?.fromWrong) {
        list = pool.filter((q) => answers[q.no] && answers[q.no] !== q.ans);
        sessionRandom75 = isRandom75Session;
      }
      if (!list.length && !opts?.resume) {
        alert("当前筛选无题目");
        return;
      }
      let startIdx = 0;
      let ans = {} as Record<number, string>;
      let rev = {} as Record<number, boolean>;
      if (opts?.resume) {
        try {
          const p = await storageGet<QuizPersist>(QUIZ_STORAGE_KEY);
          if (p && Array.isArray(p.poolNos)) {
            const map = new Map(all.map((q) => [q.no, q]));
            list = p.poolNos.map((n) => map.get(n)).filter(Boolean) as Question[];
            startIdx = p.idx || 0;
            ans = p.answers || {};
            rev = p.revealed || {};
            if (typeof p.isRandom75Session === "boolean") {
              sessionRandom75 = p.isRandom75Session;
            }
          }
        } catch {
          /* ignore */
        }
        if (!list.length) {
          alert("没有可恢复的进度");
          return;
        }
      }
      setPool(list);
      setIdx(startIdx);
      setAnswers(ans);
      setRevealed(rev);
      setIsRandom75Session(sessionRandom75);
      setPhase("quiz");
    },
    [filtered, pool, answers, all, path, isRandom75Session],
  );

  useEffect(() => {
    if (phase === "quiz") void persist();
  }, [phase, persist]);

  const q = pool[idx];
  const chosen = q ? answers[q.no] : undefined;
  const shown = q ? !!revealed[q.no] || (mode === "practice" && !!chosen) : false;

  const choose = (letter: string) => {
    if (!q) return;
    if (mode === "exam" && revealed[q.no]) return;
    setAnswers((a) => ({ ...a, [q.no]: letter }));
    if (mode === "practice") setRevealed((r) => ({ ...r, [q.no]: true }));
    if (mode === "continuous") {
      setRevealed((r) => ({ ...r, [q.no]: true }));
      setTimeout(() => {
        if (idx < pool.length - 1) setIdx((i) => i + 1);
        else setPhase("result");
      }, 450);
    }
  };

  const correctCount = pool.filter((x) => answers[x.no] === x.ans).length;

  const relatedKb = useMemo(() => {
    if (!q || catalog.length === 0) return [];
    return findRelatedKbForQuestion(q, catalog, kbDocs, 6);
  }, [q, catalog, kbDocs]);

  const relatedChips = useMemo(
    () =>
      relatedKb.map((r) => ({
        id: r.item.id,
        title: r.item.title,
        reason: r.reason,
      })),
    [relatedKb],
  );

  const kbContextHint = q
    ? `本题 · ${q.point || "考点"} · 第${q.ch}章${CH_NAMES[q.ch] ? ` ${CH_NAMES[q.ch]}` : ""}`
    : undefined;

  const openRelatedKb = useCallback(() => {
    const top = relatedKb[0]?.item;
    setKbStack(top ? [{ id: top.id, title: top.title }] : []);
    setKbOpen(true);
  }, [relatedKb]);

  const openKbRef = useCallback(
    (id: string) => {
      const hit = catalog.find((c) => c.id === id) || relatedKb.find((r) => r.item.id === id)?.item;
      if (!hit) return;
      setKbStack((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id === id) return prev;
        // 相关芯片切换：替换根篇；正文内链：压栈
        const isRelatedRoot = relatedKb.some((r) => r.item.id === id);
        if (isRelatedRoot) return [{ id: hit.id, title: hit.title }];
        return [...prev, { id: hit.id, title: hit.title }];
      });
      setKbOpen(true);
    },
    [catalog, relatedKb],
  );

  // 切题时若抽屉已开，同步到新题相关内容（以题号为键，避免整对象依赖）
  useEffect(() => {
    if (!kbOpen || phase !== "quiz" || !q) return;
    const top = relatedKb[0]?.item;
    setKbStack(top ? [{ id: top.id, title: top.title }] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随题号切换同步
  }, [q?.no, phase, kbOpen, relatedKb]);

  if (loading) return <p className="text-muted-foreground">加载题库中…</p>;

  return (
    <>
      <h1 className="page-title">刷题</h1>
      <p className="page-lead">
        自编 {meta?.practice ?? "—"} · 真题 {meta?.real ?? "—"} · 工坊 {meta?.workshop ?? "—"} · 合计{" "}
        {meta?.total ?? all.length}
        <br />
        <span className="text-[0.82rem]">
          默认「场景混淆」；需求专攻可选「需求工程（L0→L4）」按关卡顺序学（建议关随机）
        </span>
      </p>

      {phase === "setup" && (
        <>
          <ExamSprintBanner />
          {fromKbDeepLink && (chapter !== "all" || keyword.trim()) ? (
            <p className="mb-3 rounded-lg border border-primary/25 bg-primary/[0.04] px-3 py-2 text-[0.85rem] text-muted-foreground">
              已从知识点带入筛选：
              {chapter !== "all" ? (
                <>
                  {" "}
                  第 {chapter} 章 {CH_NAMES[Number(chapter)] || ""}
                </>
              ) : null}
              {keyword.trim() ? <> · 关键词「{keyword.trim()}」</> : null}
              {filtered.length > 0 ? <> · 当前匹配 {filtered.length} 题</> : <> · 暂无匹配题，可放宽关键词或改章节</>}
            </p>
          ) : null}
          <div className="layout-split">
          <aside className="layout-aside" aria-label="刷题筛选">
            <Card className="px-(--card-spacing) mb-4">
              <h2 className="mb-4 text-[1rem] font-medium">筛选</h2>
              <div className="filter-stack">
                <label className="block text-[0.82rem] text-muted-foreground">
                  学习路径
                  <select
                    className="field mt-1.5"
                    value={path}
                    onChange={(e) => {
                      const v = e.target.value as typeof path;
                      setPath(v);
                      if (v === "random75") {
                        setBank("all");
                        setChapter("all");
                        setDiff("all");
                        setYearHalf("all");
                        setLimit(75);
                        setShuffle(true);
                      } else if (v !== "all") {
                        setBank("practice");
                      }
                      if (v === "req_learn" || v === "sao_learn") {
                        setShuffle(false);
                        setChapter("11");
                        setBank("all");
                      }
                    }}
                  >
                    <option value="scenario">场景混淆（推荐）</option>
                    <option value="random75">🎲 全库随机 75 题（模考冲刺）</option>
                    <option value="req_learn">需求工程（L0→L4）</option>
                    <option value="sao_learn">结构化与OO分析（L0→L4）</option>
                    <option value="roi_boost">分值加练</option>
                    <option value="roi_stable">稳练扫盲（低权重防挂）</option>
                    <option value="frontend">前端友好</option>
                    <option value="math_easy">数学先易后难</option>
                    <option value="all">不限路径</option>
                  </select>
                </label>
                <label className="block text-[0.82rem] text-muted-foreground">
                  题库
                  <select
                    className="field mt-1.5"
                    value={bank}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBank(v);
                      if (v === "real") {
                        setPath("all");
                        setShuffle(false);
                        setDiff("all");
                      }
                    }}
                  >
                    <option value="practice">自编练习</option>
                    <option value="workshop">出题工坊（新题）</option>
                    <option value="real">综合知识真题</option>
                    <option value="paper">论文自测（结构要点）</option>
                    <option value="all">全部（含论文自测）</option>
                  </select>
                </label>
                <label className="block text-[0.82rem] text-muted-foreground">
                  场次（综合知识真题）
                  <select
                    className="field mt-1.5"
                    value={yearHalf}
                    onChange={(e) => setYearHalf(e.target.value)}
                    disabled={bank !== "real"}
                  >
                    <option value="all">全部场次</option>
                    {yearHalves.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[0.82rem] text-muted-foreground">
                  章节（自编）
                  <select className="field mt-1.5" value={chapter} onChange={(e) => setChapter(e.target.value)}>
                    <option value="all">全部章节</option>
                    {chapters.map((c) => (
                      <option key={c} value={c}>
                        第{String(c).padStart(2, "0")}章 {CH_NAMES[c] || ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[0.82rem] text-muted-foreground">
                  关键词（题干/考点）
                  <input
                    className="field mt-1.5"
                    type="search"
                    value={keyword}
                    placeholder="可选，如：DFD、挣值"
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                </label>
                <label className="block text-[0.82rem] text-muted-foreground">
                  难度
                  <select className="field mt-1.5" value={diff} onChange={(e) => setDiff(e.target.value)}>
                    <option value="all">全部难度</option>
                    <option value="basic">仅基础</option>
                    <option value="medium">仅中等</option>
                    <option value="deep">仅深度</option>
                    <option value="real">仅真题</option>
                  </select>
                </label>
                <label className="block text-[0.82rem] text-muted-foreground">
                  模式
                  <select
                    className="field mt-1.5"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as typeof mode)}
                  >
                    <option value="continuous">连续通关</option>
                    <option value="practice">练习（即时看答案）</option>
                    <option value="exam">模拟（交卷后看结果）</option>
                  </select>
                </label>
                <label className="block text-[0.82rem] text-muted-foreground">
                  题量（0=全部）
                  <input
                    className="field mt-1.5"
                    type="number"
                    min={0}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value) || 0)}
                  />
                </label>
              </div>
            </Card>
          </aside>

          <div className="layout-main space-y-4">
            {/* 全真模拟 · 随机 75 题推荐卡片 */}
            <Card className="border-primary/30 bg-primary/[0.03] dark:bg-primary/[0.05] p-4 sm:p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Dices className="size-4" />
                  </span>
                  <div>
                    <h2 className="text-[1.02rem] font-semibold text-foreground">
                      全真模拟 · 随机抽取 75 题
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      上午连考第一场 · 仅模拟综合知识选择部分
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[0.72rem] font-medium text-primary">
                  最长{EXAM_CHOICE_MAX_MINUTES}分 · 45分及格
                </span>
              </div>
              <p className="text-[0.88rem] leading-relaxed text-muted-foreground mb-4">
                从全量 <b className="text-foreground">{pureChoiceQuestions.length || 1935}</b> 道选择题（历年真题、自编精选题与工坊新题）中<b>无偏随机抽取 75 道</b>。45 分合格线，每次抽取均为全新题目组合。
                考场规则：上午综合与案例连续机考，选择题最长 {EXAM_CHOICE_MAX_MINUTES} 分钟，满{" "}
                {EXAM_CHOICE_MIN_MINUTES_BEFORE_SUBMIT} 分钟可提前交卷并<strong className="text-foreground">直接进入案例分析</strong>。
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => void startRandom75()}
                  className="gap-2 shadow-xs"
                >
                  <Dices className="size-4" />
                  <span>随机抽取 75 题并开始</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void startRandom75("exam")}
                  className="gap-1.5 text-xs"
                  title="模考模式：答题过程不透露对错与解析，交卷后统一看成绩与及格判定"
                >
                  <span>模考交卷模式</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void startRandom75("practice")}
                  className="gap-1.5 text-xs"
                  title="练习模式：每做一题即可即时查看答案与考点解析"
                >
                  <span>即时看解析模式</span>
                </Button>
              </div>
            </Card>

            {/* 常规按条件筛选卡片 */}
            <Card className="space-y-4 px-(--card-spacing)">
              <div className="flex items-center justify-between">
                <h2 className="text-[1rem] font-medium">按左侧条件刷题</h2>
                <span className="text-xs text-muted-foreground">
                  当前筛选 <b className="text-foreground">{filtered.length}</b> 题
                </span>
              </div>
              <p className="text-[0.92rem] leading-relaxed text-muted-foreground">
                可自由组合学习路径、章节、难度与场次 · 进度自动存入本机 IndexedDB
              </p>
              <div className="btn-row">
                <Button type="button" variant="default" onClick={() => void start()}>
                  开始答题
                </Button>
                <Button type="button" variant="outline" onClick={() => void start({ resume: true })}>
                  从断点继续
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShuffle((s) => !s)}>
                  随机：{shuffle ? "开" : "关"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
        </>
      )}

      {phase === "quiz" && q && (
        <div className={`kb-dock-layout${kbOpen && kbPinned ? " is-docked" : ""}`}>
          <div className="kb-dock-main layout-full">
        <Card className="px-(--card-spacing) mb-4">
          <div className="mb-3 flex items-center justify-between text-[0.85rem] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                {idx + 1} / {pool.length}
              </span>
              {(isRandom75Session || pool.length === 75) && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.72rem] font-medium text-primary">
                  <Dices className="size-3" />
                  全库随机 75 题
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>
                已答 {Object.keys(answers).length}
                {mode !== "exam" ? ` · 正确 ${correctCount}` : ""}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setSheetCardOpen(true)}
                className="h-6 gap-1 px-2 text-[0.72rem]"
              >
                <LayoutGrid className="size-3" />
                <span>答题卡</span>
              </Button>
            </div>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted/40">
            <i
              className="block h-full bg-gradient-to-r from-primary to-[var(--ok)]"
              style={{ width: `${((idx + 1) / pool.length) * 100}%` }}
            />
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5 items-center">
            {(isRandom75Session || pool.length === 75) && (
              <span className="badge border-primary/40 bg-primary/10 text-primary font-medium">
                🎲 全库随机 75 题
              </span>
            )}
            {mode === "exam" && (
              <span className="badge border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                模考模式 · 交卷看分
              </span>
            )}
            {q.bank === "real" ? (
              <>
                <span className="badge">真题</span>
                <span className="badge">{q.source || q.point}</span>
              </>
            ) : (
              <>
                <span className="badge">第{q.ch}章</span>
                <span className="badge">{q.point}</span>
              </>
            )}
            {q.learn_stage ? <span className="badge">{q.learn_stage}</span> : null}
            <span className="badge">{q.diff}</span>
            <span className="badge">{q.bank}</span>
          </div>
          <RichText
            text={q.stem}
            className="mb-5 text-[1.02rem] leading-[1.7] sm:text-[1.05rem] whitespace-pre-wrap break-words"
          />
          <div className="space-y-3">
            {["A", "B", "C", "D"].map((k) => {
              if (!q.opts[k]) return null;
              const cls = [
                "opt-btn",
                chosen === k ? "is-chosen" : "",
                shown && k === q.ans ? "is-ok" : "",
                shown && chosen === k && k !== q.ans ? "is-bad" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button key={k} type="button" className={cls} onClick={() => choose(k)}>
                  <b className="mr-2">{k}.</b>
                  {q.opts[k]}
                </button>
              );
            })}
          </div>
          {shown && (
            <div
              className={`mt-4 rounded-[12px] border bg-muted/40 p-4 text-[0.92rem] leading-relaxed sm:text-[1rem] ${
                chosen === q.ans
                  ? "border-emerald-500/50 dark:border-emerald-500/40"
                  : "border-rose-500/50 dark:border-rose-500/40"
              }`}
            >
              {chosen === q.ans ? (
                <b style={{ color: "var(--ok)" }}>正确</b>
              ) : (
                <>
                  <b style={{ color: "var(--bad)" }}>错误</b> · 你的 {chosen || "—"}，正确{" "}
                  <b>{q.ans}</b>
                </>
              )}
              {q.opt_exp && Object.keys(q.opt_exp).length > 0 ? (
                <ul className="mt-3 space-y-2 text-[0.9rem] leading-relaxed text-foreground">
                  {["A", "B", "C", "D"].map((k) => {
                    if (!q.opts[k] || !q.opt_exp?.[k]) return null;
                    const ok = k === q.ans;
                    return (
                      <li key={k} className="flex gap-2">
                        <span
                          className="shrink-0 font-semibold"
                          style={{ color: ok ? "var(--ok)" : "var(--muted-foreground)" }}
                        >
                          {k}.
                        </span>
                        <span>{q.opt_exp[k]}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : q.exp ? (
                <>
                  <br />
                  {q.exp}
                </>
              ) : null}
            </div>
          )}
          <div className="sticky-actions">
            <Button type="button" variant="outline" disabled={idx <= 0} onClick={() => setIdx((i) => i - 1)}>
              上一题
            </Button>
            <Button
              type="button"
               variant="default"
              onClick={() => {
                if (idx < pool.length - 1) setIdx((i) => i + 1);
                else setPhase("result");
              }}
            >
              {idx < pool.length - 1 ? "下一题" : "结束"}
            </Button>
            <Button
              type="button"
               variant="outline"
              onClick={() => setRevealed((r) => ({ ...r, [q.no]: true }))}
            >
              看答案
            </Button>
            <Button type="button" variant="outline" onClick={() => setSheetCardOpen(true)}>
              <LayoutGrid size={15} strokeWidth={2} aria-hidden />
              答题卡
            </Button>
            <Button type="button" variant="outline" onClick={openRelatedKb}>
              <BookOpen size={16} strokeWidth={2} aria-hidden />
              知识点{relatedKb.length ? ` · ${relatedKb.length}` : ""}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void persist()}>
              保存
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPhase("setup")}>
              设置
            </Button>
          </div>
        </Card>
          </div>
          {kbOpen && kbPinned ? (
            <KbPreviewDrawer
              open
              pinned
              onPinnedChange={setKbPinned}
              stack={kbStack}
              catalog={catalog}
              related={relatedChips}
              contextHint={kbContextHint}
              onClose={() => {
                setKbOpen(false);
                setKbStack([]);
              }}
              onBack={() => setKbStack((s) => (s.length > 1 ? s.slice(0, -1) : s))}
              onOpenRef={openKbRef}
            />
          ) : null}
        </div>
      )}

      {phase === "quiz" && !kbPinned ? (
        <KbPreviewDrawer
          open={kbOpen}
          pinned={false}
          onPinnedChange={setKbPinned}
          stack={kbStack}
          catalog={catalog}
          related={relatedChips}
          contextHint={kbContextHint}
          onClose={() => {
            setKbOpen(false);
            setKbStack([]);
          }}
          onBack={() => setKbStack((s) => (s.length > 1 ? s.slice(0, -1) : s))}
          onOpenRef={openKbRef}
        />
      ) : null}

      {/* 答题卡抽屉弹窗 */}
      <Dialog open={sheetCardOpen} onOpenChange={setSheetCardOpen}>
        <DialogContent className={cn(dialogMobileSheetClassName, "sm:max-w-xl max-h-[85dvh] flex flex-col")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="size-4 text-primary" />
              <span>答题卡</span>
              <span className="text-xs text-muted-foreground font-normal">
                （共 {pool.length} 题 · 已答 {Object.keys(answers).length} 题）
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              点击题号快速定位跳转。灰色为未作答，高亮为已作答。
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 text-xs text-muted-foreground pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm border-2 border-primary bg-primary" />
              <span>当前题</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-muted text-foreground border border-border" />
              <span>已作答</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-border/80 bg-surface/40" />
              <span>未作答</span>
            </div>
          </div>

          <div className="overflow-y-auto py-2 pr-1 max-h-[50dvh]">
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {pool.map((item, qIdx) => {
                const isCurrent = qIdx === idx;
                const isAnswered = !!answers[item.no];
                return (
                  <button
                    key={item.no}
                    type="button"
                    onClick={() => {
                      setIdx(qIdx);
                      setSheetCardOpen(false);
                    }}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-lg text-xs font-mono font-medium transition-all active:scale-95",
                      isCurrent
                        ? "border-2 border-primary bg-primary text-primary-foreground shadow-xs font-bold"
                        : isAnswered
                        ? "border border-border bg-muted/80 text-foreground hover:border-foreground/30 font-semibold"
                        : "border border-border/70 bg-surface/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {qIdx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border/60 flex sm:justify-between items-center">
            <span className="text-xs text-muted-foreground">
              作答进度：{pool.length ? Math.round((Object.keys(answers).length / pool.length) * 100) : 0}%
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setSheetCardOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {phase === "result" && (
        <div className="layout-full">
        <Card className="px-(--card-spacing) mb-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[1.15rem] font-semibold">本轮结果</h2>
            {(isRandom75Session || pool.length === 75) && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                软考上午卷 · 75 题模拟
              </span>
            )}
          </div>

          {/* 75 题模考专属评定卡片 */}
          {(isRandom75Session || pool.length === 75) && (
            <div
              className={cn(
                "mb-5 rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
                correctCount >= 45
                  ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                  : "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10 text-amber-950 dark:text-amber-100"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg font-bold text-lg",
                    correctCount >= 45
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  )}
                >
                  {correctCount >= 45 ? <Trophy className="size-5" /> : <Flame className="size-5" />}
                </div>
                <div>
                  <div className="font-semibold text-base flex items-center gap-2">
                    <span>{correctCount >= 45 ? "🎉 模考及格（成绩合格）" : "⚠️ 未达及格线（继续冲刺）"}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-current font-normal opacity-80">
                      及格线 45 / 75 分
                    </span>
                  </div>
                  <p className="text-xs opacity-90 mt-0.5">
                    {correctCount >= 45
                      ? `本次得分 ${correctCount} 分，超出及格线 ${correctCount - 45} 分！综合知识科目状态优秀，建议保持答题手感。`
                      : `本次得分 ${correctCount} 分，距离 45 分及格线还差 ${45 - correctCount} 分。建议对照错题精读考点，多抽几轮强化。`}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="default"
                onClick={() => void startRandom75()}
                className="shrink-0 w-full sm:w-auto gap-1.5 shadow-xs"
              >
                <Dices className="size-4" />
                <span>再抽一套 75 题</span>
              </Button>
            </div>
          )}

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["题量", pool.length],
              ["正确", correctCount],
              ["正确率", pool.length ? `${Math.round((correctCount / pool.length) * 100)}%` : "0%"],
              ["已答", Object.keys(answers).length],
            ].map(([k, v]) => (
              <div
                key={String(k)}
                className="rounded-[12px] border border-border bg-muted/40 p-3.5 text-center"
              >
                <span className="text-[0.75rem] text-muted-foreground">{k}</span>
                <b className="mt-1 block text-[1.2rem]">{v}</b>
              </div>
            ))}
          </div>

          <div className="btn-row">
            {(isRandom75Session || pool.length === 75) && (
              <Button type="button" variant="default" onClick={() => void startRandom75()} className="gap-1.5">
                <Dices className="size-4" />
                再抽 75 题
              </Button>
            )}
            <Button type="button" variant={isRandom75Session ? "outline" : "default"} onClick={() => void start({ fromWrong: true })}>
              只做错题
            </Button>
            <Button type="button" variant="outline" onClick={() => void start()}>
              重做本套
            </Button>
            <Button type="button" variant="outline" onClick={() => void start({ resume: true })}>
              断点继续
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPhase("setup")}>
              返回设置
            </Button>
          </div>
        </Card>
        </div>
      )}
    </>
  );
}
