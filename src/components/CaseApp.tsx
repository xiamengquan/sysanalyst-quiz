"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CH_NAMES, type CaseItem, type CasePack } from "@/lib/types";
import { CASE_STORAGE_KEY, storageGet, storageRemove, storageSet } from "@/lib/storage";
import { KbPreviewDrawer, useKbCatalog } from "@/components/KbPreviewDrawer";
import { findRelatedKbForCase } from "@/lib/quiz-kb";
import type { KbSearchDoc, KbSearchIndex } from "@/lib/kb-search";

type CaseDrafts = Record<string, Record<number, string>>;

const TRACK_LABEL: Record<string, string> = {
  P0: "P0 主攻",
  P1: "P1 保底",
  P2: "P2 止损",
};

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function RichText({ text, className }: { text: string; className?: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(IMG_RE.source, "g");
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${m.index}-${m[2]}`}
        src={m[2]}
        alt={m[1] || "配图"}
        className="my-2 max-h-[480px] w-auto max-w-full rounded-md border border-[var(--line)] bg-white"
        loading="lazy"
        referrerPolicy="no-referrer"
      />,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return (
    <div className={className ?? "whitespace-pre-wrap break-words"}>
      {nodes.length ? nodes : text}
    </div>
  );
}

export function CaseApp() {
  const [all, setAll] = useState<CaseItem[]>([]);
  const [packs, setPacks] = useState<CasePack[]>([]);
  const [bank, setBank] = useState<"all" | "practice" | "real">("all");
  const [yearHalf, setYearHalf] = useState("all");
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
  const catalog = useKbCatalog();
  const [kbDocs, setKbDocs] = useState<KbSearchDoc[]>([]);
  const [kbOpen, setKbOpen] = useState(false);
  const [kbStack, setKbStack] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/cases.json").then((r) => r.json()),
      fetch("/data/case-packs.json")
        .then((r) => (r.ok ? r.json() : { packs: [] }))
        .catch(() => ({ packs: [] })),
      storageGet<CaseDrafts>(CASE_STORAGE_KEY).catch(() => null),
      fetch("/data/kb-search-index.json")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([cases, packData, saved, kbIdx]) => {
      if (cancelled) return;
      setAll(cases);
      setPacks(Array.isArray(packData?.packs) ? packData.packs : []);
      if (saved && typeof saved === "object") setDrafts(saved);
      const docs = (kbIdx as KbSearchIndex | null)?.docs;
      setKbDocs(Array.isArray(docs) ? docs : []);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const domains = useMemo(() => [...new Set(all.map((c) => c.domain))].sort(), [all]);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const yearOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of all) {
      if (c.bank === "real" && c.year) s.add(`${c.year}${c.half || ""}`);
    }
    return [...s].sort().reverse();
  }, [all]);

  const counts = useMemo(() => {
    let practice = 0;
    let real = 0;
    const tracks = { P0: 0, P1: 0, P2: 0 };
    for (const x of all) {
      if (x.bank === "real") real += 1;
      else practice += 1;
      if (x.track === "P0" || x.track === "P1" || x.track === "P2") tracks[x.track] += 1;
    }
    return { practice, real, tracks };
  }, [all]);

  const filtered = useMemo(() => {
    let list = all.filter((c) => {
      const b = c.bank || "practice";
      if (bank === "practice" && b !== "practice") return false;
      if (bank === "real" && b !== "real") return false;
      if (yearHalf !== "all") {
        const yh = `${c.year || ""}${c.half || ""}`;
        if (yh !== yearHalf) return false;
      }
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
  }, [all, bank, yearHalf, domain, typ, track, limit]);

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

  const relatedKb = useMemo(() => {
    if (!current || catalog.length === 0) return [];
    return findRelatedKbForCase(current, catalog, kbDocs, 6);
  }, [current, catalog, kbDocs]);

  const relatedChips = useMemo(
    () =>
      relatedKb.map((r) => ({
        id: r.item.id,
        title: r.item.title,
        reason: r.reason,
      })),
    [relatedKb],
  );

  const kbContextHint = current
    ? `本案 · ${current.point || current.domain || "考点"} · 第${current.chapter}章${
        CH_NAMES[current.chapter] ? ` ${CH_NAMES[current.chapter]}` : ""
      }`
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
        const isRelatedRoot = relatedKb.some((r) => r.item.id === id);
        if (isRelatedRoot) return [{ id: hit.id, title: hit.title }];
        return [...prev, { id: hit.id, title: hit.title }];
      });
      setKbOpen(true);
    },
    [catalog, relatedKb],
  );

  useEffect(() => {
    if (!kbOpen || phase !== "quiz" || !current) return;
    const top = relatedKb[0]?.item;
    setKbStack(top ? [{ id: top.id, title: top.title }] : []);
  }, [current?.id, phase, kbOpen, relatedKb]);

  if (!ready) return <p className="text-[var(--muted)]">加载案例中…</p>;

  return (
    <>
      <h1 className="page-title">案例分析</h1>
      <p className="page-lead">
        练习 {counts.practice} · 真题 {counts.real} · 合计 {all.length} · P0 {counts.tracks.P0} / P1{" "}
        {counts.tracks.P1} / P2 {counts.tracks.P2}
      </p>

      {(phase === "setup" || phase === "list") && (
        <div className="layout-split">
          <aside className="layout-aside" aria-label="案例筛选">
            <div className="card space-y-4">
              <h2 className="text-[1rem] font-medium">筛选</h2>
              <div className="filter-stack">
                <label className="block text-[0.82rem] text-[var(--muted)]">
                  题库
                  <select
                    className="field mt-1.5"
                    value={bank}
                    onChange={(e) => {
                      const v = e.target.value as "all" | "practice" | "real";
                      setBank(v);
                      if (v !== "real") setYearHalf("all");
                    }}
                  >
                    <option value="all">全部</option>
                    <option value="practice">练习（自编）</option>
                    <option value="real">真题</option>
                  </select>
                </label>
                <label className="block text-[0.82rem] text-[var(--muted)]">
                  年份
                  <select
                    className="field mt-1.5"
                    value={yearHalf}
                    onChange={(e) => setYearHalf(e.target.value)}
                    disabled={bank === "practice"}
                  >
                    <option value="all">全部年份</option>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[0.82rem] text-[var(--muted)]">
                  路径
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
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => startPool(filtered)}
                >
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
              <p className="text-[0.85rem] leading-relaxed text-[var(--muted)]">
                当前筛选 {filtered.length} 套 · 草稿存 IndexedDB
              </p>
            </div>
          </aside>

          <div className="layout-main">
            {phase === "setup" && (
              <div className="stack">
                {packs.length > 0 && (
                  <div className="card space-y-4 border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]">
                    <h2 className="text-[1rem] font-medium">模拟包 / 真题卷</h2>
                    <p className="text-[0.85rem] leading-relaxed text-[var(--muted)]">
                      真题包按卷演练；自编五选三包：第 1 题必答，其余选答两题。
                    </p>
                    <ul className="list-gap">
                      {packs.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="min-h-14 w-full rounded-xl border border-[var(--line)] bg-[#121820] px-4 py-4 text-left hover:border-[#4a5d73]"
                            onClick={() => startPack(p)}
                          >
                            <div className="text-[0.95rem]">{p.title}</div>
                            <div className="mt-1.5 text-[0.78rem] leading-relaxed text-[var(--muted)]">
                              {p.cases.join(" · ")}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="card space-y-3">
                  <h2 className="text-[1rem] font-medium">自由练习</h2>
                  <p className="text-[0.9rem] leading-relaxed text-[var(--muted)]">
                    左侧调筛选后点「列出练习」；真题配图可能为外链。
                  </p>
                </div>
              </div>
            )}

            {phase === "list" && (
              <div className="card">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[1rem] font-medium">练习列表</h2>
                  <button type="button" className="btn btn-ghost" onClick={() => setPhase("setup")}>
                    返回概览
                  </button>
                </div>
                {packHint ? (
                  <p className="mb-4 text-[0.85rem] leading-relaxed text-[var(--muted)]">{packHint}</p>
                ) : null}
                <ul className="list-gap">
                  {pool.map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="min-h-14 w-full rounded-xl border border-[var(--line)] bg-[#121820] px-4 py-4 text-left hover:border-[#4a5d73]"
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
                        <div className="mt-1.5 text-[0.78rem] leading-relaxed text-[var(--muted)]">
                          {c.bank === "real" ? "真题 · " : ""}
                          {c.track ? TRACK_LABEL[c.track] || c.track : ""}
                          {c.stop_loss ? " · 止损" : ""} · 第{c.chapter}章 · 建议{" "}
                          {c.time_limit_min || 25} 分钟
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === "quiz" && current && (
        <div className="layout-full">
        <div className="card">
          <div className="mb-3 flex justify-between text-[0.85rem] text-[var(--muted)]">
            <span>
              第 {idx + 1} / {pool.length} 套
            </span>
            <span>建议用时 {current.time_limit_min || 25} 分钟</span>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {current.bank === "real" ? <span className="badge">真题</span> : <span className="badge">练习</span>}
            <span className="badge">{current.domain}</span>
            <span className="badge">{current.case_type}</span>
            {current.track ? <span className="badge">{TRACK_LABEL[current.track] || current.track}</span> : null}
            {current.stop_loss ? <span className="badge">止损答法</span> : null}
            <span className="badge">
              第{current.chapter}章 · {CH_NAMES[current.chapter] || ""}
            </span>
          </div>
          <RichText
            text={current.stem}
            className="mb-5 whitespace-pre-wrap break-words rounded-[12px] border border-[var(--line)] bg-[#121820] p-4 text-[0.95rem] leading-[1.7] sm:text-[1rem]"
          />
          <div className="space-y-5">
            {current.questions.map((qq) => (
              <div key={qq.qnum}>
                <h4 className="mb-3 text-[0.95rem] leading-snug">
                  问题{qq.qnum}　
                  <RichText text={qq.prompt} className="inline whitespace-pre-wrap break-words" />
                </h4>
                <textarea
                  className="field"
                  rows={5}
                  placeholder="在此作答（草稿仅存本机）…"
                  value={drafts[current.id]?.[qq.qnum] || ""}
                  onChange={(e) => updateAns(current.id, qq.qnum, e.target.value)}
                />
                {reveal && (
                  <div className="mt-3 rounded-[12px] border border-[color-mix(in_srgb,var(--ok)_40%,var(--line))] bg-[#143028] p-4 text-[0.9rem] leading-relaxed break-words">
                    <b style={{ color: "var(--ok)" }}>参考要点（非唯一）</b>
                    <RichText
                      text={qq.rubric?.sample || "（无）"}
                      className="mt-2 whitespace-pre-wrap break-words"
                    />
                    {qq.hint ? (
                      <p className="mt-2 text-[var(--muted)]">提示：{qq.hint}</p>
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
            <button type="button" className="btn" onClick={openRelatedKb}>
              知识点{relatedKb.length ? ` · ${relatedKb.length}` : ""}
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
