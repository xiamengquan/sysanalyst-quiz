"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CH_NAMES, type Question } from "@/lib/types";
import { QUIZ_STORAGE_KEY, storageGet, storageSet } from "@/lib/storage";
import { KbPreviewDrawer, useKbCatalog } from "@/components/KbPreviewDrawer";
import { findRelatedKbForQuestion } from "@/lib/quiz-kb";
import type { KbSearchDoc, KbSearchIndex } from "@/lib/kb-search";

type Meta = { practice: number; real: number; workshop: number; total: number };

type QuizPersist = {
  poolNos?: number[];
  idx?: number;
  answers?: Record<number, string>;
  revealed?: Record<number, boolean>;
  mode?: string;
};

export function QuizApp() {
  const [all, setAll] = useState<Question[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [bank, setBank] = useState("practice");
  const [year, setYear] = useState("all");
  const [chapter, setChapter] = useState("all");
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
  >("scenario");
  const [mode, setMode] = useState<"continuous" | "practice" | "exam">("continuous");
  const [limit, setLimit] = useState(0);
  const [shuffle, setShuffle] = useState(false);
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

  const years = useMemo(() => {
    const s = new Set<string>();
    all.filter((q) => q.bank === "real" && q.year).forEach((q) => s.add(String(q.year)));
    return [...s].sort();
  }, [all]);

  const chapters = useMemo(() => {
    const s = new Set<number>();
    all.filter((q) => q.bank === "practice").forEach((q) => s.add(q.ch));
    return [...s].sort((a, b) => a - b);
  }, [all]);

  const filtered = useMemo(() => {
    const feCh = new Set([4, 7, 9, 12, 13, 14, 15]);
    let list = all.filter((q) => {
      if (bank === "paper") return q.bank === "paper";
      if (bank !== "all" && q.bank !== bank) return false;
      if (bank === "all" && q.bank === "paper" && path !== "roi_boost" && path !== "all") return false;
      if (bank === "real" && year !== "all" && String(q.year) !== year) return false;
      if ((bank === "practice" || bank === "all") && chapter !== "all" && String(q.ch) !== chapter) {
        if (q.bank === "paper") return path === "roi_boost" || path === "all";
        return false;
      }
      if (diff !== "all" && q.diff !== diff) return false;
      if (path === "frontend") {
        if (q.bank === "real") return true;
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
    if (path === "req_learn" || path === "sao_learn") {
      const stageRank: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
      list = [...list].sort((a, b) => {
        const ra = stageRank[String(a.learn_stage || "")] ?? 9;
        const rb = stageRank[String(b.learn_stage || "")] ?? 9;
        if (ra !== rb) return ra - rb;
        return a.no - b.no;
      });
    } else if (shuffle) {
      list = [...list].sort(() => Math.random() - 0.5);
    }
    if (limit > 0) list = list.slice(0, limit);
    return list;
  }, [all, bank, year, chapter, diff, path, shuffle, limit]);

  const persist = useCallback(async () => {
    try {
      await storageSet(QUIZ_STORAGE_KEY, {
        poolNos: pool.map((q) => q.no),
        idx,
        answers,
        revealed,
        mode,
      });
    } catch {
      /* ignore */
    }
  }, [pool, idx, answers, revealed, mode]);

  const start = useCallback(
    async (opts?: { fromWrong?: boolean; resume?: boolean }) => {
      let list = filtered;
      if (opts?.fromWrong) {
        list = pool.filter((q) => answers[q.no] && answers[q.no] !== q.ans);
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
      setPhase("quiz");
    },
    [filtered, pool, answers, all],
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

  // 切题时若抽屉已开，同步到新题相关内容
  useEffect(() => {
    if (!kbOpen || phase !== "quiz" || !q) return;
    const top = relatedKb[0]?.item;
    setKbStack(top ? [{ id: top.id, title: top.title }] : []);
  }, [q?.no, phase, kbOpen, relatedKb]);

  if (loading) return <p className="text-[var(--muted)]">加载题库中…</p>;

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
        <div className="layout-split">
          <aside className="layout-aside" aria-label="刷题筛选">
            <div className="card">
              <h2 className="mb-4 text-[1rem] font-medium">筛选</h2>
              <div className="filter-stack">
                <label className="block text-[0.82rem] text-[var(--muted)]">
                  学习路径
                  <select
                    className="field mt-1.5"
                    value={path}
                    onChange={(e) => {
                      const v = e.target.value as typeof path;
                      setPath(v);
                      if (v !== "all") setBank("practice");
                      if (v === "req_learn" || v === "sao_learn") {
                        setShuffle(false);
                        setChapter("11");
                        setBank("all");
                      }
                    }}
                  >
                    <option value="scenario">场景混淆（推荐）</option>
                    <option value="req_learn">需求工程（L0→L4）</option>
                    <option value="sao_learn">结构化与OO分析（L0→L4）</option>
                    <option value="roi_boost">分值加练</option>
                    <option value="roi_stable">稳练扫盲（低权重防挂）</option>
                    <option value="frontend">前端友好</option>
                    <option value="math_easy">数学先易后难</option>
                    <option value="all">不限路径</option>
                  </select>
                </label>
                <label className="block text-[0.82rem] text-[var(--muted)]">
                  题库
                  <select className="field mt-1.5" value={bank} onChange={(e) => setBank(e.target.value)}>
                    <option value="practice">自编练习</option>
                    <option value="workshop">出题工坊（新题）</option>
                    <option value="real">真题选择题</option>
                    <option value="paper">论文自测（结构要点）</option>
                    <option value="all">全部（含论文自测）</option>
                  </select>
                </label>
                <label className="block text-[0.82rem] text-[var(--muted)]">
                  年份（真题）
                  <select className="field mt-1.5" value={year} onChange={(e) => setYear(e.target.value)}>
                    <option value="all">全部年份</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[0.82rem] text-[var(--muted)]">
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
                <label className="block text-[0.82rem] text-[var(--muted)]">
                  难度
                  <select className="field mt-1.5" value={diff} onChange={(e) => setDiff(e.target.value)}>
                    <option value="all">全部难度</option>
                    <option value="basic">仅基础</option>
                    <option value="medium">仅中等</option>
                    <option value="deep">仅深度</option>
                    <option value="real">仅真题</option>
                  </select>
                </label>
                <label className="block text-[0.82rem] text-[var(--muted)]">
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
                <label className="block text-[0.82rem] text-[var(--muted)]">
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
            </div>
          </aside>

          <div className="layout-main">
            <div className="card space-y-4">
              <h2 className="text-[1rem] font-medium">开始本轮</h2>
              <p className="text-[0.92rem] leading-relaxed text-[var(--muted)]">
                当前筛选 <b className="text-[var(--text)]">{filtered.length}</b> 题 · 进度存 IndexedDB
              </p>
              <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={() => void start()}>
                  开始答题
                </button>
                <button type="button" className="btn" onClick={() => void start({ resume: true })}>
                  从断点继续
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShuffle((s) => !s)}>
                  随机：{shuffle ? "开" : "关"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === "quiz" && q && (
        <div className="layout-full">
        <div className="card">
          <div className="mb-3 flex justify-between text-[0.85rem] text-[var(--muted)]">
            <span>
              {idx + 1} / {pool.length}
            </span>
            <span>
              已答 {Object.keys(answers).length} · 正确 {correctCount}
            </span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#121820]">
            <i
              className="block h-full bg-gradient-to-r from-[#2f7fd4] to-[#3ecf8e]"
              style={{ width: `${((idx + 1) / pool.length) * 100}%` }}
            />
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="badge">第{q.ch}章</span>
            <span className="badge">{q.point}</span>
            {q.learn_stage ? <span className="badge">{q.learn_stage}</span> : null}
            <span className="badge">{q.diff}</span>
            <span className="badge">{q.bank}</span>
          </div>
          <div className="mb-5 text-[1.02rem] leading-[1.7] sm:text-[1.05rem]">{q.stem}</div>
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
              className={`mt-4 rounded-[12px] border bg-[#121820] p-4 text-[0.92rem] leading-relaxed sm:text-[1rem] ${
                chosen === q.ans
                  ? "border-[color-mix(in_srgb,var(--ok)_50%,var(--line))]"
                  : "border-[color-mix(in_srgb,var(--bad)_50%,var(--line))]"
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
              <br />
              {q.exp}
            </div>
          )}
          <div className="sticky-actions">
            <button type="button" className="btn" disabled={idx <= 0} onClick={() => setIdx((i) => i - 1)}>
              上一题
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (idx < pool.length - 1) setIdx((i) => i + 1);
                else setPhase("result");
              }}
            >
              {idx < pool.length - 1 ? "下一题" : "结束"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setRevealed((r) => ({ ...r, [q.no]: true }))}
            >
              看答案
            </button>
            <button type="button" className="btn" onClick={openRelatedKb}>
              知识点{relatedKb.length ? ` · ${relatedKb.length}` : ""}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void persist()}>
              保存
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase("setup")}>
              设置
            </button>
          </div>
        </div>
        </div>
      )}

      {phase === "result" && (
        <div className="layout-full">
        <div className="card">
          <h2 className="mb-4 text-[1.15rem]">本轮结果</h2>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["题量", pool.length],
              ["正确", correctCount],
              ["正确率", pool.length ? `${Math.round((correctCount / pool.length) * 100)}%` : "0%"],
              ["已答", Object.keys(answers).length],
            ].map(([k, v]) => (
              <div
                key={String(k)}
                className="rounded-[12px] border border-[var(--line)] bg-[#121820] p-3.5 text-center"
              >
                <span className="text-[0.75rem] text-[var(--muted)]">{k}</span>
                <b className="mt-1 block text-[1.2rem]">{v}</b>
              </div>
            ))}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => void start({ fromWrong: true })}>
              只做错题
            </button>
            <button type="button" className="btn" onClick={() => void start()}>
              再来一轮
            </button>
            <button type="button" className="btn" onClick={() => void start({ resume: true })}>
              断点继续
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase("setup")}>
              返回设置
            </button>
          </div>
        </div>
        </div>
      )}

      <KbPreviewDrawer
        open={kbOpen && phase === "quiz"}
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
    </>
  );
}
