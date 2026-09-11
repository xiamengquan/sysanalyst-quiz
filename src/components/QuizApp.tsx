"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CH_NAMES, type Question } from "@/lib/types";
import { QUIZ_STORAGE_KEY, storageGet, storageSet } from "@/lib/storage";

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
  const [bank, setBank] = useState("workshop");
  const [year, setYear] = useState("all");
  const [chapter, setChapter] = useState("all");
  const [diff, setDiff] = useState("all");
  const [mode, setMode] = useState<"continuous" | "practice" | "exam">("continuous");
  const [limit, setLimit] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [pool, setPool] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [phase, setPhase] = useState<"setup" | "quiz" | "result">("setup");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/data/questions.json").then((r) => r.json()),
      fetch("/data/question-meta.json").then((r) => r.json()),
    ]).then(([qs, m]) => {
      setAll(qs);
      setMeta(m);
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
    let list = all.filter((q) => {
      if (bank !== "all" && q.bank !== bank) return false;
      if (bank === "real" && year !== "all" && String(q.year) !== year) return false;
      if (bank === "practice" && chapter !== "all" && String(q.ch) !== chapter) return false;
      if (diff !== "all" && q.diff !== diff) return false;
      return true;
    });
    if (shuffle) list = [...list].sort(() => Math.random() - 0.5);
    if (limit > 0) list = list.slice(0, limit);
    return list;
  }, [all, bank, year, chapter, diff, shuffle, limit]);

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

  if (loading) return <p className="text-[var(--muted)]">加载题库中…</p>;

  return (
    <>
      <h1 className="mb-1 text-[1.35rem] font-semibold">刷题</h1>
      <p className="mb-5 text-[0.9rem] text-[var(--muted)]">
        自编 {meta?.practice ?? "—"} · 真题 {meta?.real ?? "—"} · 工坊 {meta?.workshop ?? "—"} · 合计{" "}
        {meta?.total ?? all.length}
      </p>

      {phase === "setup" && (
        <div className="card space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-[0.82rem] text-[var(--muted)]">
              题库
              <select className="field mt-1.5" value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="workshop">出题工坊（新题）</option>
                <option value="practice">自编练习</option>
                <option value="real">真题选择题</option>
                <option value="all">全部</option>
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
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn btn-primary" onClick={() => void start()}>
              开始答题
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void start()}>
              连续通关 · 当前筛选
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void start({ resume: true })}>
              从断点继续
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShuffle((s) => !s)}>
              随机打乱：{shuffle ? "开" : "关"}
            </button>
          </div>
          <p className="text-[0.9rem] text-[var(--muted)]">当前筛选 {filtered.length} 题 · 进度存 IndexedDB</p>
        </div>
      )}

      {phase === "quiz" && q && (
        <div className="card">
          <div className="mb-2 flex justify-between text-[0.85rem] text-[var(--muted)]">
            <span>
              {idx + 1} / {pool.length}
            </span>
            <span>
              已答 {Object.keys(answers).length} · 正确 {correctCount}
            </span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#121820]">
            <i
              className="block h-full bg-gradient-to-r from-[#2f7fd4] to-[#3ecf8e]"
              style={{ width: `${((idx + 1) / pool.length) * 100}%` }}
            />
          </div>
          <div className="mb-2">
            <span className="badge">第{q.ch}章</span>
            <span className="badge">{q.point}</span>
            <span className="badge">{q.diff}</span>
            <span className="badge">{q.bank}</span>
          </div>
          <div className="mb-4 text-[1.05rem] leading-relaxed">{q.stem}</div>
          <div className="space-y-2">
            {["A", "B", "C", "D"].map((k) => {
              if (!q.opts[k]) return null;
              let cls =
                "block w-full rounded-xl border border-[var(--line)] bg-[#121820] px-3.5 py-3 text-left hover:border-[#4a5d73]";
              if (chosen === k) cls += " border-[var(--accent)] bg-[#173049]";
              if (shown && k === q.ans) cls += " border-[var(--ok)] bg-[#143028]";
              if (shown && chosen === k && k !== q.ans) cls += " border-[var(--bad)] bg-[#2a1719]";
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
              className={`mt-3 rounded-[10px] border bg-[#121820] p-3 leading-relaxed ${
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
          <div className="mt-3 flex flex-wrap gap-2">
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
              查看答案
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void persist()}>
              保存进度
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase("setup")}>
              返回设置
            </button>
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="card">
          <h2 className="mb-3 text-[1.15rem]">本轮结果</h2>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["题量", pool.length],
              ["正确", correctCount],
              ["正确率", pool.length ? `${Math.round((correctCount / pool.length) * 100)}%` : "0%"],
              ["已答", Object.keys(answers).length],
            ].map(([k, v]) => (
              <div
                key={String(k)}
                className="rounded-[10px] border border-[var(--line)] bg-[#121820] p-2.5 text-center"
              >
                <span className="text-[0.75rem] text-[var(--muted)]">{k}</span>
                <b className="mt-0.5 block text-[1.2rem]">{v}</b>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => void start({ fromWrong: true })}>
              只做错题
            </button>
            <button type="button" className="btn" onClick={() => void start({ resume: true })}>
              从断点继续
            </button>
            <button type="button" className="btn" onClick={() => void start()}>
              再来一轮
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase("setup")}>
              返回设置
            </button>
          </div>
        </div>
      )}
    </>
  );
}
