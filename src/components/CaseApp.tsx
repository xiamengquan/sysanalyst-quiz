"use client";

import { useEffect, useMemo, useState } from "react";
import { CH_NAMES, type CaseItem } from "@/lib/types";

const CASE_STORAGE_KEY = "sysanalyst_case_v1";

export function CaseApp() {
  const [all, setAll] = useState<CaseItem[]>([]);
  const [domain, setDomain] = useState("all");
  const [typ, setTyp] = useState("all");
  const [limit, setLimit] = useState(0);
  const [phase, setPhase] = useState<"setup" | "list" | "quiz">("setup");
  const [pool, setPool] = useState<CaseItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Record<number, string>>>({});
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    fetch("/data/cases.json")
      .then((r) => r.json())
      .then(setAll);
    try {
      const raw = localStorage.getItem(CASE_STORAGE_KEY);
      if (raw) setDrafts(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const domains = useMemo(() => [...new Set(all.map((c) => c.domain))].sort(), [all]);

  const filtered = useMemo(() => {
    let list = all.filter((c) => {
      if (domain !== "all" && c.domain !== domain) return false;
      if (typ !== "all" && c.case_type !== typ) return false;
      return true;
    });
    if (limit > 0) list = list.slice(0, limit);
    return list;
  }, [all, domain, typ, limit]);

  const current = pool[idx];

  const saveDrafts = (next: typeof drafts) => {
    setDrafts(next);
    localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(next));
  };

  const updateAns = (qid: string, qnum: number, val: string) => {
    const bag = { ...(drafts[qid] || {}), [qnum]: val };
    saveDrafts({ ...drafts, [qid]: bag });
  };

  return (
    <>
      <h1 className="mb-1 text-[1.35rem] font-semibold">案例分析</h1>
      <p className="mb-5 text-[0.9rem] text-[var(--muted)]">
        自编 {all.length} 套 · 背景 + 三问 · 参考要点非唯一答案
      </p>

      {phase === "setup" && (
        <div className="card space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-[0.82rem] text-[var(--muted)]">
              领域
              <select className="field mt-1.5" value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="all">全部领域</option>
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[0.82rem] text-[var(--muted)]">
              题型
              <select className="field mt-1.5" value={typ} onChange={(e) => setTyp(e.target.value)}>
                <option value="all">全部题型</option>
                <option value="方案对比">方案对比</option>
                <option value="架构设计">架构设计</option>
                <option value="分析改进">分析改进</option>
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setPool(filtered);
                setPhase("list");
              }}
            >
              列出练习
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (confirm("清空本机全部案例分析作答草稿？")) {
                  saveDrafts({});
                }
              }}
            >
              清空本机作答草稿
            </button>
          </div>
          <p className="text-[0.9rem] text-[var(--muted)]">当前筛选 {filtered.length} 套</p>
        </div>
      )}

      {phase === "list" && (
        <div className="card">
          <button type="button" className="btn btn-ghost mb-3" onClick={() => setPhase("setup")}>
            返回筛选
          </button>
          <ul className="space-y-2">
            {pool.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-[var(--line)] bg-[#121820] px-3.5 py-3 text-left hover:border-[#4a5d73]"
                  onClick={() => {
                    setIdx(i);
                    setReveal(false);
                    setPhase("quiz");
                  }}
                >
                  <div className="text-[0.95rem]">
                    {c.id} · {c.point}
                  </div>
                  <div className="mt-1 text-[0.78rem] text-[var(--muted)]">
                    第{c.chapter}章 · 建议 {c.time_limit_min || 25} 分钟
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === "quiz" && current && (
        <div className="card">
          <div className="mb-2 flex justify-between text-[0.85rem] text-[var(--muted)]">
            <span>
              第 {idx + 1} / {pool.length} 套
            </span>
            <span>建议用时 {current.time_limit_min || 25} 分钟</span>
          </div>
          <div className="mb-3">
            <span className="badge">{current.domain}</span>
            <span className="badge">{current.case_type}</span>
            <span className="badge">
              第{current.chapter}章 · {CH_NAMES[current.chapter] || ""}
            </span>
          </div>
          <div className="mb-4 whitespace-pre-wrap rounded-[10px] border border-[var(--line)] bg-[#121820] p-3 leading-relaxed">
            {current.stem}
          </div>
          <div className="space-y-4">
            {current.questions.map((qq) => (
              <div key={qq.qnum}>
                <h4 className="mb-2 text-[0.95rem]">
                  问题{qq.qnum}　{qq.prompt}
                </h4>
                <textarea
                  className="field min-h-[88px]"
                  placeholder="在此作答（草稿仅存本机）…"
                  value={drafts[current.id]?.[qq.qnum] || ""}
                  onChange={(e) => updateAns(current.id, qq.qnum, e.target.value)}
                />
                {reveal && (
                  <div className="mt-2 rounded-[10px] border border-[color-mix(in_srgb,var(--ok)_40%,var(--line))] bg-[#143028] p-3 text-[0.9rem] leading-relaxed">
                    <b style={{ color: "var(--ok)" }}>参考要点（非唯一）</b>
                    <br />
                    {qq.rubric?.sample || "（无）"}
                    {qq.hint ? (
                      <>
                        <br />
                        <span className="text-[var(--muted)]">提示：{qq.hint}</span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn"
              disabled={idx <= 0}
              onClick={() => {
                setReveal(false);
                setIdx((i) => i - 1);
              }}
            >
              上一套
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={idx >= pool.length - 1}
              onClick={() => {
                setReveal(false);
                setIdx((i) => i + 1);
              }}
            >
              下一套
            </button>
            <button type="button" className="btn" onClick={() => setReveal(true)}>
              查看参考要点
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(drafts))}
            >
              保存草稿
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase("list")}>
              返回列表
            </button>
          </div>
        </div>
      )}
    </>
  );
}
