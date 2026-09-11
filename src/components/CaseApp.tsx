"use client";

import { useEffect, useMemo, useState } from "react";
import { CH_NAMES, type CaseItem, type CasePack } from "@/lib/types";
import { CASE_STORAGE_KEY, storageGet, storageRemove, storageSet } from "@/lib/storage";

type CaseDrafts = Record<string, Record<number, string>>;

const TRACK_LABEL: Record<string, string> = {
  P0: "P0 主攻",
  P1: "P1 保底",
  P2: "P2 止损",
};

export function CaseApp() {
  const [all, setAll] = useState<CaseItem[]>([]);
  const [packs, setPacks] = useState<CasePack[]>([]);
  const [domain, setDomain] = useState("all");
  const [typ, setTyp] = useState("all");
  const [track, setTrack] = useState("frontend");
  const [limit, setLimit] = useState(0);
  const [phase, setPhase] = useState<"setup" | "list" | "quiz">("setup");
  const [pool, setPool] = useState<CaseItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<CaseDrafts>({});
  const [reveal, setReveal] = useState(false);
  const [ready, setReady] = useState(false);
  const [packHint, setPackHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/cases.json").then((r) => r.json()),
      fetch("/data/case-packs.json")
        .then((r) => (r.ok ? r.json() : { packs: [] }))
        .catch(() => ({ packs: [] })),
      storageGet<CaseDrafts>(CASE_STORAGE_KEY).catch(() => null),
    ]).then(([cases, packData, saved]) => {
      if (cancelled) return;
      setAll(cases);
      setPacks(Array.isArray(packData?.packs) ? packData.packs : []);
      if (saved && typeof saved === "object") setDrafts(saved);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const domains = useMemo(() => [...new Set(all.map((c) => c.domain))].sort(), [all]);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);

  const trackCounts = useMemo(() => {
    const c = { P0: 0, P1: 0, P2: 0 };
    for (const x of all) {
      if (x.track === "P0" || x.track === "P1" || x.track === "P2") c[x.track] += 1;
    }
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    let list = all.filter((c) => {
      if (domain !== "all" && c.domain !== domain) return false;
      if (typ !== "all" && c.case_type !== typ) return false;
      if (track === "frontend") {
        if (c.track !== "P0") return false;
      } else if (track === "stop_loss") {
        if (!c.stop_loss && c.track !== "P2") return false;
      } else if (track !== "all" && c.track !== track) {
        return false;
      }
      return true;
    });
    if (limit > 0) list = list.slice(0, limit);
    return list;
  }, [all, domain, typ, track, limit]);

  const current = pool[idx];

  const saveDrafts = async (next: CaseDrafts) => {
    setDrafts(next);
    try {
      await storageSet(CASE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const updateAns = (qid: string, qnum: number, val: string) => {
    const bag = { ...(drafts[qid] || {}), [qnum]: val };
    void saveDrafts({ ...drafts, [qid]: bag });
  };

  const startPool = (list: CaseItem[], hint = "") => {
    setPool(list);
    setPackHint(hint);
    setIdx(0);
    setReveal(false);
    setPhase(list.length ? "list" : "setup");
  };

  const startPack = (pack: CasePack) => {
    const list = pack.cases.map((id) => byId.get(id)).filter(Boolean) as CaseItem[];
    const hint = [
      pack.rule || "试题一必答；试题二～五选答两题",
      pack.select_hint || "",
      pack.mandatory != null ? `必答：CA-${String(pack.mandatory).padStart(3, "0")}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    startPool(list, hint);
  };

  if (!ready) return <p className="text-[var(--muted)]">加载案例中…</p>;

  return (
    <>
      <h1 className="mb-1 text-[1.35rem] font-semibold">案例分析</h1>
      <p className="mb-5 text-[0.9rem] text-[var(--muted)]">
        自编 {all.length} 套 · 前端五选三路径加深 · P0 {trackCounts.P0} / P1 {trackCounts.P1} / P2{" "}
        {trackCounts.P2}
      </p>

      {phase === "setup" && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-[0.82rem] text-[var(--muted)]">
                前端路径
                <select className="field mt-1.5" value={track} onChange={(e) => setTrack(e.target.value)}>
                  <option value="frontend">推荐主攻（P0）</option>
                  <option value="P0">仅 P0</option>
                  <option value="P1">仅 P1 保底</option>
                  <option value="P2">仅 P2 止损</option>
                  <option value="stop_loss">止损域（嵌入式/CPS）</option>
                  <option value="all">全部路径</option>
                </select>
              </label>
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
            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={() => startPool(filtered)}>
                列出练习
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (confirm("清空本机全部案例分析作答草稿？")) {
                    void storageRemove(CASE_STORAGE_KEY).then(() => setDrafts({}));
                  }
                }}
              >
                清空草稿
              </button>
            </div>
            <p className="text-[0.9rem] text-[var(--muted)]">
              当前筛选 {filtered.length} 套 · 草稿存 IndexedDB · 默认「推荐主攻」= 需求/Web/移动/微服务/集成
            </p>
          </div>

          {packs.length > 0 && (
            <div className="card space-y-3">
              <h2 className="text-[1rem] font-medium">五选三模拟包</h2>
              <p className="text-[0.85rem] text-[var(--muted)]">
                每包 5 题：第 1 题必答，其余 4 题选答 2 题；练习时建议 60 秒选题。
              </p>
              <ul className="space-y-2">
                {packs.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="min-h-14 w-full rounded-xl border border-[var(--line)] bg-[#121820] px-3.5 py-3.5 text-left hover:border-[#4a5d73]"
                      onClick={() => startPack(p)}
                    >
                      <div className="text-[0.95rem]">{p.title}</div>
                      <div className="mt-1 text-[0.78rem] text-[var(--muted)]">
                        {p.cases.join(" · ")}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {phase === "list" && (
        <div className="card">
          <button type="button" className="btn btn-ghost mb-3" onClick={() => setPhase("setup")}>
            返回筛选
          </button>
          {packHint ? <p className="mb-3 text-[0.85rem] text-[var(--muted)]">{packHint}</p> : null}
          <ul className="space-y-2">
            {pool.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="min-h-14 w-full rounded-xl border border-[var(--line)] bg-[#121820] px-3.5 py-3.5 text-left hover:border-[#4a5d73]"
                  onClick={() => {
                    setIdx(i);
                    setReveal(false);
                    setPhase("quiz");
                  }}
                >
                  <div className="text-[0.95rem]">
                    {c.id} · {c.point}
                    {i === 0 && packHint.includes("必答") ? "（建议必答）" : ""}
                  </div>
                  <div className="mt-1 text-[0.78rem] text-[var(--muted)]">
                    {c.track ? TRACK_LABEL[c.track] || c.track : ""}
                    {c.stop_loss ? " · 止损" : ""} · 第{c.chapter}章 · 建议 {c.time_limit_min || 25} 分钟
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
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="badge">{current.domain}</span>
            <span className="badge">{current.case_type}</span>
            {current.track ? <span className="badge">{TRACK_LABEL[current.track] || current.track}</span> : null}
            {current.stop_loss ? <span className="badge">止损答法</span> : null}
            <span className="badge">
              第{current.chapter}章 · {CH_NAMES[current.chapter] || ""}
            </span>
          </div>
          <div className="mb-4 whitespace-pre-wrap break-words rounded-[10px] border border-[var(--line)] bg-[#121820] p-3 text-[0.95rem] leading-relaxed sm:text-[1rem]">
            {current.stem}
          </div>
          <div className="space-y-4">
            {current.questions.map((qq) => (
              <div key={qq.qnum}>
                <h4 className="mb-2 text-[0.95rem] leading-snug">
                  问题{qq.qnum}　{qq.prompt}
                </h4>
                <textarea
                  className="field"
                  rows={5}
                  placeholder="在此作答（草稿仅存本机）…"
                  value={drafts[current.id]?.[qq.qnum] || ""}
                  onChange={(e) => updateAns(current.id, qq.qnum, e.target.value)}
                />
                {reveal && (
                  <div className="mt-2 rounded-[10px] border border-[color-mix(in_srgb,var(--ok)_40%,var(--line))] bg-[#143028] p-3 text-[0.9rem] leading-relaxed break-words">
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
          <div className="sticky-actions">
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
              看要点
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void storageSet(CASE_STORAGE_KEY, drafts)}
            >
              保存
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase("list")}>
              列表
            </button>
          </div>
        </div>
      )}
    </>
  );
}
