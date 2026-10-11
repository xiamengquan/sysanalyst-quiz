"use client";

/**
 * 运用演练场 · Tutorial 式步骤链训练
 * 每格：情境提问 → 自己写「这一步的作用/差异」 → 系统比对关键点判定 → 揭示范例句/作用/辨析/易错 → 下一格。
 * 数据：public/data/drills.json（npm run build:drills 由 content/drills/*.md 构建）
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ChevronLeft, Layers, RotateCcw, Send, Target, TriangleAlert, XCircle } from "lucide-react";
import { judgeAnswer, type MatchResult } from "@/lib/answer-match";
import { storageGet, storageSet } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DrillStep = {
  idx: number;
  name: string;
  ask: string;
  key: string;
  model: string;
  role: string;
  diff: string;
  trap: string;
  story?: string;
  src?: { href: string; label: string };
};

type DrillDeck = {
  id: string;
  title: string;
  domain: string;
  scene: string;
  story?: string;
  steps: DrillStep[];
};

type DrillsData = { meta: { builtAt: string; decks: number; steps: number }; decks: DrillDeck[] };

/** 本机记录：每链完成次数与最近成绩 */
type DrillRecord = Record<string, { runs: number; best: string; weak: string[] }>;
const STORAGE_KEY = "sysanalyst_drill_v1";
const STORY_MODE_KEY = "sysanalyst_drill_story_v1";

type Phase = "select" | "run" | "done";

const VERDICT_META = {
  correct: { text: "关键点全中", cls: "text-green-600 dark:text-green-400", Icon: CheckCircle2 },
  partial: { text: "部分命中", cls: "text-amber-600 dark:text-amber-400", Icon: TriangleAlert },
  wrong: { text: "未命中关键点", cls: "text-red-600 dark:text-red-400", Icon: XCircle },
  manual: { text: "无法自动判定", cls: "text-muted-foreground", Icon: Target },
} as const;

export function DrillApp() {
  const [data, setData] = useState<DrillsData | null>(null);
  const [record, setRecord] = useState<DrillRecord>({});
  const [ready, setReady] = useState(false);
  const [storyMode, setStoryMode] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(STORY_MODE_KEY) !== "0" : true,
  );

  const toggleStory = useCallback((next: boolean) => {
    setStoryMode(next);
    try {
      window.localStorage.setItem(STORY_MODE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const [phase, setPhase] = useState<Phase>("select");
  const [deck, setDeck] = useState<DrillDeck | null>(null);
  const [queue, setQueue] = useState<DrillStep[]>([]); // 本轮演练格
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0); // 0=无 1=答题句式 2=要点词
  const [session, setSession] = useState<{ correct: number; partial: number; wrong: number; weak: string[] }>({
    correct: 0,
    partial: 0,
    wrong: 0,
    weak: [],
  });

  useEffect(() => {
    fetch("/data/drills.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: DrillsData) => {
        setData(d);
        setReady(true);
        // 深链 /drill/?deck=<id>：直接进入该链
        const q = new URLSearchParams(window.location.search).get("deck");
        const target = q ? d.decks.find((x) => x.id === q || x.title === q) : null;
        if (target) startDeck(target, d);
      })
      .catch(() => setReady(true));
    storageGet<DrillRecord>(STORAGE_KEY).then((r) => r && setRecord(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDeck = useCallback((d: DrillDeck, src?: DrillsData) => {
    setDeck(d);
    setQueue(d.steps);
    setIdx(0);
    setAnswer("");
    setResult(null);
    setHintLevel(0);
    setSession({ correct: 0, partial: 0, wrong: 0, weak: [] });
    setPhase("run");
    void src; // 保留参数签名，深链时无需再读 state
  }, []);

  const submit = useCallback(() => {
    if (!deck || !answer.trim()) return;
    const step = queue[idx];
    if (!step) return;
    const r = judgeAnswer(step.ask, step.key || step.model, answer);
    setResult(r);
    setSession((s) => {
      const next = {
        correct: s.correct + (r.verdict === "correct" ? 1 : 0),
        partial: s.partial + (r.verdict === "partial" ? 1 : 0),
        wrong: s.wrong + (r.verdict === "wrong" || r.verdict === "manual" ? 1 : 0),
        weak: s.weak,
      };
      if (r.verdict !== "correct" && !s.weak.includes(step.name)) next.weak = [...s.weak, step.name];
      return next;
    });
  }, [deck, answer, queue, idx]);

  const next = useCallback(() => {
    if (idx >= queue.length - 1) {
      // 收尾：写入本机记录
      if (deck) {
        const best =
          session.wrong === 0 && session.partial === 0
            ? "全对"
            : session.wrong === 0
              ? "有薄弱"
              : "需重练";
        setRecord((prev) => {
          const cur = prev[deck.id] ?? { runs: 0, best: "—", weak: [] };
          const merged = {
            runs: cur.runs + 1,
            best,
            weak: Array.from(new Set([...cur.weak, ...session.weak])),
          };
          void storageSet(STORAGE_KEY, { ...prev, [deck.id]: merged });
          return { ...prev, [deck.id]: merged };
        });
      }
      setPhase("done");
      return;
    }
    setIdx((i) => i + 1);
    setAnswer("");
    setResult(null);
    setHintLevel(0);
  }, [idx, queue.length, deck, session]);

  const retryWeak = useCallback(() => {
    if (!deck) return;
    const weakSteps = deck.steps.filter((s) => session.weak.includes(s.name));
    if (!weakSteps.length) return;
    setQueue(weakSteps);
    setIdx(0);
    setAnswer("");
    setResult(null);
    setHintLevel(0);
    setSession({ correct: 0, partial: 0, wrong: 0, weak: [] });
    setPhase("run");
  }, [deck, session.weak]);

  const back = useCallback(() => {
    setPhase("select");
    setDeck(null);
    setQueue([]);
    setIdx(0);
    setResult(null);
    setAnswer("");
  }, []);

  const progress = useMemo(() => (queue.length ? Math.round(((idx + (result ? 1 : 0)) / queue.length) * 100) : 0), [idx, queue.length, result]);

  if (!ready) return <p className="text-muted-foreground">加载演练库中…</p>;
  if (!data || !data.decks.length)
    return (
      <p className="text-muted-foreground">
        演练库为空——请运行 <code>npm run build:drills</code> 生成 public/data/drills.json
      </p>
    );

  const rec = deck ? record[deck.id] : undefined;

  return (
    <>
      <h1 className="page-title">运用演练场 · 步骤链</h1>
      <p className="page-lead">
        知识点「记住了」≠「写得出来」。Tutorial 式一格一格练：
        <span className="text-[0.82rem]"> 自己写出这一步的<b>作用与差异</b> → 系统比对关键点 → 对照可抄上卷的范例句与易错点。卡住了用「阶梯提示」：先给答题句式，再给要点词，最后一档才看范例。</span>
      </p>

      {phase === "select" && (
        <div className="space-y-3">
          {data.decks.map((d) => {
            const r = record[d.id];
            return (
              <Card key={d.id} className="px-(--card-spacing) py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Layers className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <b>{d.title}</b>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.72rem] text-muted-foreground">{d.domain}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[0.82rem] text-muted-foreground">{d.scene}</p>
                    <p className="mt-1 text-[0.75rem] text-muted-foreground">
                      {d.steps.length} 格 · {r ? `已练 ${r.runs} 次 · 最近「${r.best}」${r.weak.length ? ` · 薄弱格：${r.weak.join("、")}` : ""}` : "未开始"}
                    </p>
                  </div>
                  <Button size="sm" className="shrink-0" onClick={() => startDeck(d)}>
                    {r ? "再练" : "开始"}
                  </Button>
                </div>
              </Card>
            );
          })}
          <p className="text-[0.78rem] text-muted-foreground">
            配合使用：先读对应知识点（每格末尾有溯源深链），再回来默练；午休 30 分钟正好走完一条链。
          </p>
        </div>
      )}

      {phase === "run" && deck && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[0.82rem] text-muted-foreground">
            <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={back}>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> 换链
            </button>
            <div className="flex items-center gap-3">
              {deck?.story ? (
                <button
                  type="button"
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[0.72rem] transition-colors",
                    storyMode
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={storyMode}
                  onClick={() => toggleStory(!storyMode)}
                >
                  🎭 故事 {storyMode ? "开" : "关"}
                </button>
              ) : null}
              <span>
                {deck.title} · 第 {idx + 1}/{queue.length} 格
              </span>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>

          {(() => {
            const step = queue[idx];
            if (!step) return null;
            const meta = result ? VERDICT_META[result.verdict] : null;
            return (
              <>
                {idx === 0 && deck?.story && storyMode ? (
                  <Card className="px-(--card-spacing) py-3 space-y-1 border-primary/30 bg-primary/5">
                    <p className="text-[0.78rem] font-medium text-primary">🎭 故事线开场（帮脑子挂上钩，考场忘词时顺着剧情推）</p>
                    <p className="text-[0.86rem] leading-relaxed">{deck.story}</p>
                  </Card>
                ) : null}
                <Card className="px-(--card-spacing) py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.75rem] font-medium text-primary">
                      步骤 {step.idx} · {step.name}
                    </span>
                  </div>
                  <p className="text-[0.95rem] font-medium">{step.ask}</p>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={4}
                    disabled={!!result}
                    placeholder="像写在答题纸上一样作答。句式：第几步 + 绘制/进行〈什么〉：对〈……〉进行〈……〉，形成〈产出〉，为〈下一步〉提供依据。作用：用于……"
                    className="w-full rounded-lg border border-border bg-muted/30 p-3 text-[0.9rem] outline-none focus:border-primary disabled:opacity-70"
                  />
                  {!result && (
                    <div className="space-y-2">
                      {hintLevel >= 1 && (
                        <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                          <p className="mb-1 text-[0.78rem] font-medium text-primary">🪜 提示一 · 答题句式（三件套缺一不可）</p>
                          <p className="text-[0.86rem] leading-relaxed">
                            <b>① 动作</b>：第几步 + 绘制／进行〈什么〉；<b>② 产出</b>：形成〈图／模型／文档〉；<b>③ 作用</b>：用于……，为〈下一步〉提供依据。
                            <br />
                            句式模板：「第 X 步〈绘制 XX 图 / 进行 XX〉：对〈……〉进行〈……〉，形成〈……〉，为后续〈……〉提供依据。」
                          </p>
                        </div>
                      )}
                      {hintLevel >= 2 && step.key && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                          <p className="mb-1.5 text-[0.78rem] font-medium text-amber-600 dark:text-amber-400">🪜 提示二 · 本步要点词（比对就看这些词——先自己憋完句子再看）</p>
                          <div className="flex flex-wrap gap-1.5">
                            {step.key
                              .split(/[／/、]/)
                              .map((w) => w.trim())
                              .filter(Boolean)
                              .map((w) => (
                                <span key={w} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.75rem] text-amber-700 dark:text-amber-400">
                                  {w}
                                </span>
                              ))}
                          </div>
                          <p className="mt-1.5 text-[0.75rem] text-muted-foreground">别只罗列名词——把每个词织进句式模板，「动词 + 产出 + 作用」才是能上卷的完整句。</p>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={result || hintLevel >= (step.key ? 2 : 1)}
                        onClick={() => setHintLevel((h) => Math.min(step.key ? 2 : 1, h + 1))}
                      >
                        {hintLevel === 0 ? "🪜 卡住了？点提示" : hintLevel === 1 && step.key ? "🪜 还不行？给要点词" : "提示已全开（写完提交吧）"}
                      </Button>
                      <Button className="w-full" onClick={submit} disabled={!answer.trim()}>
                        <Send className="h-4 w-4" aria-hidden /> 提交比对
                      </Button>
                    </div>
                  )}
                  {result && meta && (
                      <div className={cn("flex items-center gap-2 text-[0.88rem] font-medium", meta.cls)}>
                        <meta.Icon className="h-4 w-4" aria-hidden />
                        {meta.text}
                        {result.total > 0 && (
                          <span className="text-[0.78rem] font-normal text-muted-foreground">
                            （命中 {result.hits}/{result.total} 关键点）
                          </span>
                        )}
                      </div>
                  )}
                  {result && result.hitTokens.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {result.hitTokens.map((t) => (
                        <span key={t} className="rounded-full bg-green-500/10 px-2 py-0.5 text-[0.72rem] text-green-600 dark:text-green-400">
                          ✓ {t}
                        </span>
                      ))}
                      {result.missTokens.map((t) => (
                        <span key={t} className="rounded-full bg-red-500/10 px-2 py-0.5 text-[0.72rem] text-red-600 dark:text-red-400">
                          ✗ {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>

                {result && (
                  <Card className="px-(--card-spacing) py-4 space-y-3 border-primary/30">
                    <div>
                      <p className="mb-1 text-[0.78rem] font-medium text-primary">✍ 范例句（可直接改写成你的答题句）</p>
                      <p className="text-[0.9rem] leading-relaxed">{step.model}</p>
                    </div>
                    {step.role && (
                      <div>
                        <p className="mb-1 text-[0.78rem] font-medium text-primary">🎯 一句话作用</p>
                        <p className="text-[0.88rem] text-muted-foreground">{step.role}</p>
                      </div>
                    )}
                    {storyMode && step.story ? (
                      <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                        <p className="mb-1 text-[0.78rem] font-medium text-primary">🎭 记忆剧情</p>
                        <p className="text-[0.86rem] leading-relaxed">{step.story}</p>
                      </div>
                    ) : null}
                    {step.diff && (
                      <div>
                        <p className="mb-1 text-[0.78rem] font-medium text-primary">⚖ 与相邻步骤 / 易混概念的差异</p>
                        <p className="text-[0.88rem] leading-relaxed">{step.diff}</p>
                      </div>
                    )}
                    {step.trap && (
                      <div>
                        <p className="mb-1 text-[0.78rem] font-medium text-red-600 dark:text-red-400">⚠ 易错点</p>
                        <p className="text-[0.88rem] text-muted-foreground">{step.trap}</p>
                      </div>
                    )}
                    {step.src && (
                      <Link href={step.src.href} className="inline-flex items-center gap-1 text-[0.8rem] text-primary hover:underline">
                        <BookOpen className="h-3.5 w-3.5" aria-hidden /> 回知识点：{step.src.label}
                      </Link>
                    )}
                    <Button className="w-full" onClick={next}>
                      {idx >= queue.length - 1 ? "查看本轮小结" : "下一格"}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </Card>
                )}
              </>
            );
          })()}
        </div>
      )}

      {phase === "done" && deck && (
        <div className="space-y-3">
          <Card className="px-(--card-spacing) py-4 space-y-2 text-center">
            <p className="text-[0.82rem] text-muted-foreground">{deck.title} · 本轮 {queue.length} 格</p>
            <p className="text-[1.5rem] font-semibold">
              {session.correct} <span className="text-[0.9rem] text-muted-foreground">全中</span> · {session.partial}{" "}
              <span className="text-[0.9rem] text-muted-foreground">部分</span> · {session.wrong}{" "}
              <span className="text-[0.9rem] text-muted-foreground">未中</span>
            </p>
            {session.weak.length > 0 ? (
              <p className="text-[0.85rem] text-muted-foreground">
                薄弱格：<b className="text-foreground">{session.weak.join("、")}</b>
                <br />
                <span className="text-[0.78rem]">建议点开对应知识点溯源重读一遍，再回来只练薄弱格。</span>
              </p>
            ) : (
              <p className="text-[0.85rem] text-green-600 dark:text-green-400">全链通关 🎉 这条步骤链已经能写上卷了。</p>
            )}
          </Card>
          <div className="flex flex-wrap gap-2">
            {session.weak.length > 0 && (
              <Button variant="outline" onClick={retryWeak}>
                <RotateCcw className="h-4 w-4" aria-hidden /> 只练薄弱格（{session.weak.length}）
              </Button>
            )}
            <Button variant="outline" onClick={() => startDeck(deck)}>
              <RotateCcw className="h-4 w-4" aria-hidden /> 重练整链
            </Button>
            <Button variant="outline" onClick={back}>
              换一条链
            </Button>
          </div>
          <p className="text-[0.78rem] text-muted-foreground">
            {rec ? `本机记录：该链已练 ${rec.runs} 次 · 最近「${rec.best}」` : "进度与本机记录已保存。"}
          </p>
        </div>
      )}
    </>
  );
}