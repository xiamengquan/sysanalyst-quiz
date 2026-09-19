"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { CH_NAMES, type CaseItem, type CasePack } from "@/lib/types";
import { CASE_STORAGE_KEY, storageGet, storageRemove, storageSet } from "@/lib/storage";
import { KbPreviewDrawer, useKbCatalog } from "@/components/KbPreviewDrawer";
import { RichText } from "@/components/RichText";
import { findRelatedKbForCase } from "@/lib/quiz-kb";
import type { KbSearchDoc, KbSearchIndex } from "@/lib/kb-search";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CaseDrafts = Record<string, Record<number, string>>;

const TRACK_LABEL: Record<string, string> = {
  P0: "P0 主攻",
  P1: "P1 保底",
  P2: "P2 止损",
};

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
  const [quizTab, setQuizTab] = useState<"answer" | "seven">("answer");
  const [ready, setReady] = useState(false);
  const [packHint, setPackHint] = useState("");
  const catalog = useKbCatalog();
  const [kbDocs, setKbDocs] = useState<KbSearchDoc[]>([]);
  const [kbOpen, setKbOpen] = useState(false);
  const [kbStack, setKbStack] = useState<{ id: string; title: string }[]>([]);
  const [kbPinned, setKbPinned] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随案例 id 切换同步
  }, [current?.id, phase, kbOpen, relatedKb]);

  if (!ready) return <p className="text-muted-foreground">加载案例中…</p>;

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
            <Card className="space-y-4 px-(--card-spacing) mb-4">
              <h2 className="text-[1rem] font-medium">筛选</h2>
              <div className="filter-stack">
                <label className="block text-[0.82rem] text-muted-foreground">
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
                <label className="block text-[0.82rem] text-muted-foreground">
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
                <label className="block text-[0.82rem] text-muted-foreground">
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
                <label className="block text-[0.82rem] text-muted-foreground">
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
                <label className="block text-[0.82rem] text-muted-foreground">
                  题型
                  <select className="field mt-1.5" value={typ} onChange={(e) => setTyp(e.target.value)}>
                    <option value="all">全部题型</option>
                    <option value="方案对比">方案对比</option>
                    <option value="架构设计">架构设计</option>
                    <option value="分析改进">分析改进</option>
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
              <div className="btn-row">
                <Button
                  type="button"
                   variant="default"
                  onClick={() => startPool(filtered)}
                >
                  列出练习
                </Button>
                <Button
                  type="button"
                   variant="ghost"
                  onClick={() => {
                    if (confirm("清空本机全部案例分析作答草稿？")) {
                      void storageRemove(CASE_STORAGE_KEY).then(() => setDrafts({}));
                    }
                  }}
                >
                  清空草稿
                </Button>
              </div>
              <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
                当前筛选 {filtered.length} 套 · 草稿存 IndexedDB
              </p>
            </Card>
          </aside>

          <div className="layout-main">
            {phase === "setup" && (
              <div className="stack">
                {packs.length > 0 && (
                  <Card className="space-y-4 border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] px-(--card-spacing) mb-4">
                    <h2 className="text-[1rem] font-medium">模拟包 / 真题卷</h2>
                    <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
                      真题包按卷演练；自编五选三包：第 1 题必答，其余选答两题。
                    </p>
                    <ul className="list-gap">
                      {packs.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="min-h-14 w-full rounded-xl border border-border bg-muted/40 px-4 py-4 text-left hover:border-border"
                            onClick={() => startPack(p)}
                          >
                            <div className="text-[0.95rem]">{p.title}</div>
                            <div className="mt-1.5 text-[0.78rem] leading-relaxed text-muted-foreground">
                              {p.cases.join(" · ")}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                <Card className="space-y-3 px-(--card-spacing) mb-4">
                  <h2 className="text-[1rem] font-medium">自由练习</h2>
                  <p className="text-[0.9rem] leading-relaxed text-muted-foreground">
                    左侧调筛选后点「列出练习」；真题配图可能为外链。
                  </p>
                </Card>
              </div>
            )}

            {phase === "list" && (
              <Card className="px-(--card-spacing) mb-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[1rem] font-medium">练习列表</h2>
                  <Button type="button" variant="ghost" onClick={() => setPhase("setup")}>
                    返回概览
                  </Button>
                </div>
                {packHint ? (
                  <p className="mb-4 text-[0.85rem] leading-relaxed text-muted-foreground">{packHint}</p>
                ) : null}
                <ul className="list-gap">
                  {pool.map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="min-h-14 w-full rounded-xl border border-border bg-muted/40 px-4 py-4 text-left hover:border-border"
                        onClick={() => {
                          setIdx(i);
                          setReveal(false);
                          setQuizTab("answer");
                          setPhase("quiz");
                        }}
                      >
                        <div className="text-[0.95rem]">
                          {c.id} · {c.point}
                          {i === 0 && packHint.includes("必答") ? "（建议必答）" : ""}
                        </div>
                        <div className="mt-1.5 text-[0.78rem] leading-relaxed text-muted-foreground">
                          {c.bank === "real" ? "真题 · " : ""}
                          {c.track ? TRACK_LABEL[c.track] || c.track : ""}
                          {c.stop_loss ? " · 止损" : ""} · 第{c.chapter}章 · 建议{" "}
                          {c.time_limit_min || 25} 分钟
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {phase === "quiz" && current && (
        <div className={`kb-dock-layout${kbOpen && kbPinned ? " is-docked" : ""}`}>
          <div className="kb-dock-main layout-full">
        <Card className="px-(--card-spacing) mb-4">
          <div className="mb-3 flex justify-between text-[0.85rem] text-muted-foreground">
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
            className="mb-5 whitespace-pre-wrap break-words rounded-[12px] border border-border bg-muted/40 p-4 text-[0.95rem] leading-[1.7] sm:text-[1rem]"
          />

          <div className="mb-4 flex gap-1 border-b border-border" role="tablist" aria-label="答题视图">
            <button
              type="button"
              role="tab"
              aria-selected={quizTab === "answer"}
              className={`rounded-t-lg px-3.5 py-2 text-[0.88rem] transition ${
                quizTab === "answer"
                  ? "border border-b-transparent border-border bg-card text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setQuizTab("answer")}
            >
              作答
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={quizTab === "seven"}
              disabled={!current.seven_steps?.length}
              className={`rounded-t-lg px-3.5 py-2 text-[0.88rem] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                quizTab === "seven"
                  ? "border border-b-transparent border-border bg-card text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setQuizTab("seven")}
              title={current.seven_steps?.length ? "按教程七步法拆解本题" : "本题暂无七步法"}
            >
              七步法
            </button>
          </div>

          {quizTab === "seven" && current.seven_steps?.length ? (
            <div className="mb-5 space-y-4" role="tabpanel">
              <p className="text-[0.82rem] leading-relaxed text-muted-foreground">
                依据《案例分析答题教程》单题 7 步法，结合本题题干与设问整理。可与「作答」页对照练习。
              </p>
              {current.seven_steps.map((step, i) => (
                <div
                  key={`${step.title}-${i}`}
                  className="rounded-[12px] border border-border bg-muted/40 p-4"
                >
                  <h4 className="mb-2 text-[0.95rem] font-medium text-primary">{step.title}</h4>
                  <div className="space-y-2 text-[0.88rem] leading-relaxed">
                    <div>
                      <span className="text-muted-foreground">怎么做 · </span>
                      <RichText text={step.how} className="inline whitespace-pre-wrap break-words" />
                    </div>
                    {step.why ? (
                      <div>
                        <span className="text-muted-foreground">为什么 · </span>
                        <RichText text={step.why} className="inline whitespace-pre-wrap break-words" />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div className="space-y-5" role="tabpanel">
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
                  <div className="mt-3 rounded-[12px] border border-[color-mix(in_srgb,var(--ok)_40%,var(--border))] bg-primary/10 p-4 text-[0.9rem] leading-relaxed break-words">
                    <b style={{ color: "var(--ok)" }}>参考要点（非唯一）</b>
                    <RichText
                      text={qq.rubric?.sample || "（无）"}
                      className="mt-2 whitespace-pre-wrap break-words"
                    />
                    {qq.hint ? (
                      <p className="mt-2 text-muted-foreground">提示：{qq.hint}</p>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
          <div className="sticky-actions">
            <Button
              type="button"
               variant="outline"
              disabled={idx <= 0}
              onClick={() => {
                setReveal(false);
                setQuizTab("answer");
                setIdx((i) => i - 1);
              }}
            >
              上一套
            </Button>
            <Button
              type="button"
               variant="default"
              disabled={idx >= pool.length - 1}
              onClick={() => {
                setReveal(false);
                setQuizTab("answer");
                setIdx((i) => i + 1);
              }}
            >
              下一套
            </Button>
            <Button type="button" variant="outline" onClick={() => setReveal(true)} disabled={quizTab !== "answer"}>
              看要点
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openRelatedKb}>
              <BookOpen size={16} strokeWidth={2} aria-hidden />
              知识点{relatedKb.length ? ` · ${relatedKb.length}` : ""}
            </Button>
            <Button
              type="button"
               variant="ghost"
              onClick={() => void storageSet(CASE_STORAGE_KEY, drafts)}
            >
              保存
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPhase("list")}>
              列表
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

      {phase === "quiz" && kbOpen && !kbPinned ? (
        <KbPreviewDrawer
          open
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
    </>
  );
}
