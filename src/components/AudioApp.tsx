"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PlayMode = "qa" | "drill";
type Order = "seq" | "rand";
const REPEAT_OPTIONS = [2, 3, 5];
const LIMIT_OPTIONS = [0, 15, 30, 60]; // 分钟，0 = 不限

const AUDIO_SETTINGS_KEY = "sysanalyst_audio_settings_v1";

/** 讲透文章（来自 audio-articles.json：39 点逐点讲透，连贯朗读） */
type ArticleParagraph = { id: string; no: number; pid: string; title: string; text: string };
type ArticleDoc = {
  id: string;
  title: string;
  group: string;
  prefix: string;
  intro: string;
  paragraphs: ArticleParagraph[];
};

/** 统一播放卡：flash 卡与演练卡共用 */
type AnyCard = {
  id: string;
  front: string;
  back: string;
  /** 问答模式自定义问/答（演练卡用范例句作答） */
  qText?: string;
  aText?: string;
  group?: string;
};

/** TTS 读文本清理：去 markdown 残留，符号转口语，提升听感 */
export function speakText(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/_/g, "")
    .replace(/[★]/g, "，重点，")
    .replace(/〔([^〕]*)〕/g, "，$1，")
    .replace(/[｜|]/g, "，")
    .replace(/[＞>]/g, " 大于 ")
    .replace(/→/g, " 到 ")
    .replace(/[＝=]/g, " 等于 ")
    .replace(/；/g, "。")
    .replace(/(?<=[\u4e00-\u9fff])\/(?=[\u4e00-\u9fff])/g, " 或 ")
    .replace(/[《》【】[\]「」『』`#*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type PlayItem = {
  key: string;
  front: string;
  back: string;
  group?: string;
  /** 依模式生成的朗读行序列 */
  lines: { text: string; kind: "q" | "a" }[];
};

function buildItems(cards: AnyCard[], mode: PlayMode, repeat: number): PlayItem[] {
  return cards.map((c) => {
    const lines: PlayItem["lines"] = [];
    if (mode === "qa") {
      lines.push({ text: speakText(c.qText || c.front), kind: "q" });
      lines.push({ text: speakText(c.aText || c.back), kind: "a" });
    } else {
      for (let i = 0; i < repeat; i++) lines.push({ text: speakText(c.back), kind: "a" });
    }
    return { key: c.id, front: c.front, back: c.back, group: c.group, lines };
  });
}

function shuffle<T>(items: T[]): T[] {
  const r = [...items];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** 讲透文章段 → 音频卡：问 = 章节标题播报，答 = 该点完整讲透文本 */
function articleToCards(docs: ArticleDoc[], filter: string): AnyCard[] {
  return docs
    .filter((d) => filter === "all" || d.prefix === filter)
    .flatMap((d) =>
      d.paragraphs.map((p) => ({
        id: p.id,
        group: d.group.replace("文章", ""),
        front: `第${p.no}点 ${p.title}`,
        back: p.text,
        qText: `第${p.no}点，${p.title}。`,
        aText: p.text,
      }))
    );
}

export function AudioApp() {
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");

  const [mode, setMode] = useState<PlayMode>("drill");
  const [repeat, setRepeat] = useState(3);
  const [rate, setRate] = useState(1.1);
  const [order, setOrder] = useState<Order>("seq");
  const [limitMin, setLimitMin] = useState(0);
  const [articleDocs, setArticleDocs] = useState<ArticleDoc[]>([]);
  const [articleFilter, setArticleFilter] = useState("all");
  const [loopAll, setLoopAll] = useState(false);
  const loopAllRef = useRef(loopAll);

  const [phase, setPhase] = useState<"setup" | "playing">("setup");
  const [items, setItems] = useState<PlayItem[]>([]);
  const [playIdx, setPlayIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const idxRef = useRef(0);
  const lineRef = useRef(0);
  const rateRef = useRef(rate);
  const deadlineRef = useRef(0);
  const stoppingRef = useRef(false);
  /** 播放世代号：stop/跳转时自增，使旧播放链（cancel 触发的 onend/onerror）失效 */
  const genRef = useRef(0);

  // 设置持久化
  useEffect(() => {
    const saved = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.mode) setMode(s.mode);
        if (s.repeat) setRepeat(s.repeat);
        if (s.rate) setRate(s.rate);
        if (s.order) setOrder(s.order);
        if (typeof s.limitMin === "number") setLimitMin(s.limitMin);
        if (s.articleFilter) setArticleFilter(s.articleFilter);
        if (typeof s.loopAll === "boolean") setLoopAll(s.loopAll);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      AUDIO_SETTINGS_KEY,
      JSON.stringify({ mode, repeat, rate, order, limitMin, articleFilter, loopAll })
    );
  }, [mode, repeat, rate, order, limitMin, articleFilter, loopAll]);

  useEffect(() => {
    loopAllRef.current = loopAll;
  }, [loopAll]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    if (!ok) {
      setReady(true);
      return;
    }
    const loadVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      const zh = vs.filter((v) => v.lang.toLowerCase().startsWith("zh"));
      setVoices(zh.length ? zh : vs);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    fetch("/data/audio-articles.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.articles) setArticleDocs(d.articles);
      })
      .catch(() => undefined);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    };
  }, []);

  const filtered = useMemo(() => articleToCards(articleDocs, articleFilter), [articleDocs, articleFilter]);

  const pickVoice = useCallback(() => {
    if (!voiceURI) return undefined;
    return voices.find((v) => v.voiceURI === voiceURI);
  }, [voiceURI, voices]);

  const speakLine = useCallback(
    (text: string, gen: number, onend: () => void) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = rateRef.current;
      u.pitch = 1;
      u.onend = () => {
        if (genRef.current !== gen || stoppingRef.current) return;
        onend();
      };
      u.onerror = () => {
        if (genRef.current !== gen || stoppingRef.current) return;
        onend();
      };
      window.speechSynthesis.speak(u);
    },
    [pickVoice]
  );

  const stop = useCallback(() => {
    stoppingRef.current = true;
    genRef.current += 1; // 使 pending 的播放链失效
    window.speechSynthesis.cancel();
    setPhase("setup");
    setPaused(false);
    setItems([]);
    setPlayIdx(0);
  }, []);

  const step = useCallback(
    (list: PlayItem[], gen: number) => {
      if (genRef.current !== gen || stoppingRef.current) return;
      if (deadlineRef.current && Date.now() > deadlineRef.current) {
        stop();
        return;
      }
      if (idxRef.current >= list.length) {
        if (loopAllRef.current && list.length) {
          // 整组无限循环：回到第一张继续
          idxRef.current = 0;
          lineRef.current = 0;
          setPlayIdx(0);
          setTimeout(() => step(list, gen), 1500);
          return;
        }
        stop();
        return;
      }
      const it = list[idxRef.current];
      const li = lineRef.current;
      if (li >= it.lines.length) {
        idxRef.current += 1;
        lineRef.current = 0;
        setPlayIdx(idxRef.current);
        setTimeout(() => step(list, gen), 600); // 卡间停顿
        return;
      }
      setPlayIdx(idxRef.current);
      speakLine(it.lines[li].text, gen, () => {
        lineRef.current += 1;
        setTimeout(() => step(list, gen), it.lines[li].kind === "q" ? 1200 : 350);
      });
    },
    [speakLine, stop]
  );

  const start = useCallback(() => {
    if (!filtered.length) {
      alert("当前筛选没有可用卡片");
      return;
    }
    const base = buildItems(filtered, mode, repeat);
    const list = order === "rand" ? shuffle(base) : base;
    genRef.current += 1;
    stoppingRef.current = false;
    idxRef.current = 0;
    lineRef.current = 0;
    deadlineRef.current = limitMin ? Date.now() + limitMin * 60_000 : 0;
    setItems(list);
    setPlayIdx(0);
    setPaused(false);
    setPhase("playing");
    setTimeout(() => step(list, genRef.current), 300);
  }, [filtered, mode, repeat, order, limitMin, step]);

  const togglePause = useCallback(() => {
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }, [paused]);

  const jump = useCallback(
    (delta: number) => {
      const list = items;
      const next = Math.min(Math.max(idxRef.current + delta, 0), list.length - 1);
      genRef.current += 1; // 失效旧链，避免 cancel 触发 onerror 双跳
      window.speechSynthesis.cancel();
      stoppingRef.current = false;
      idxRef.current = next;
      lineRef.current = 0;
      setPlayIdx(next);
      setPaused(false);
      const gen = genRef.current;
      setTimeout(() => step(list, gen), 250);
    },
    [items, step]
  );

  if (!ready) return <p className="text-muted-foreground">加载卡库中…</p>;

  if (!supported)
    return (
      <Card className="px-(--card-spacing) mb-4">
        <p className="text-[0.95rem] leading-relaxed">
          当前浏览器不支持语音合成（Web Speech API）。建议使用 Chrome / Edge / Safari
          最新版访问本页，或直接使用手机系统自带的「文字转语音」功能朗读{" "}
          <Link href="/kb/quick-four-tier-7d/" className="underline underline-offset-2">
            四层七日背诵总册
          </Link>
          。
        </p>
      </Card>
    );

  const current = items[playIdx];
  const zhVoiceLabel = (v: SpeechSynthesisVoice) => `${v.name}（${v.lang}）`;

  return (
    <>
      <h1 className="page-title">知识点洗脑音频 · 语音循环</h1>
      <p className="page-lead">
        四大方面 39 点讲透文章（连贯朗读）转为语音流：问答式（读题→停顿→读答案）或洗脑式（答案连读 N 遍），支持整组 ∞ 无限循环
        <br />
        <span className="text-[0.82rem]">
          适合通勤/散步等零散时间 · 语音由设备合成，免下载 · 注意：锁屏后部分手机会暂停，建议亮屏播放或连接耳机
        </span>
      </p>

      {phase === "setup" && (
        <Card className="px-(--card-spacing) mb-4 space-y-4">
          <div>
            <h2 className="mb-2 text-[1rem] font-medium">卡池</h2>
          <div>
            <h2 className="mb-2 text-[1rem] font-medium">播放模式</h2>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["drill", `洗脑式（答案连读 ×${repeat}）`],
                  ["qa", "问答式（读题→停顿→答案）"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMode(v)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[0.8rem] transition-colors",
                    mode === v
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
              {mode === "drill" && (
                <span className="flex items-center gap-1 text-[0.8rem] text-muted-foreground">
                  遍数：
                  {REPEAT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRepeat(n)}
                      className={cn(
                        "rounded-md border px-2 py-0.5",
                        repeat === n
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      ×{n}
                    </button>
                  ))}
                </span>
              )}
            </div>
          </div>
          <div>
              <h2 className="mb-2 text-[1rem] font-medium">文章范围（四大方面 39 点）</h2>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "全部（39 点）"],
                    ["req", "需求工程（10 点）"],
                    ["web", "Web 架构（10 点）"],
                    ["mic", "微服务（9 点）"],
                    ["db", "数据库（10 点）"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setArticleFilter(v)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[0.8rem] transition-colors",
                      articleFilter === v
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-[1rem] font-medium">整组循环</h2>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  [false, "播完一遍停止"],
                  [true, "∞ 无限循环"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setLoopAll(v)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[0.8rem] transition-colors",
                    loopAll === v
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <h2 className="mb-2 text-[1rem] font-medium">
                语速 <span className="text-[0.8rem] text-muted-foreground">{rate.toFixed(1)}x</span>
              </h2>
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.1}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-40"
              />
            </div>
            <div>
              <h2 className="mb-2 text-[1rem] font-medium">播放顺序</h2>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["seq", "顺序"],
                    ["rand", "随机"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOrder(v)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[0.8rem] transition-colors",
                      order === v
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-[1rem] font-medium">定时停止</h2>
              <div className="flex flex-wrap gap-1.5">
                {LIMIT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLimitMin(n)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[0.8rem] transition-colors",
                      limitMin === n
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {n === 0 ? "不限" : `${n} 分钟`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {voices.length > 0 && (
            <div>
              <h2 className="mb-2 text-[1rem] font-medium">发音人（设备语音）</h2>
              <select
                value={voiceURI}
                onChange={(e) => setVoiceURI(e.target.value)}
                className="max-w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.85rem]"
              >
                <option value="">默认</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {zhVoiceLabel(v)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="btn-row">
            <Button type="button" variant="default" onClick={start} className="gap-1.5 shadow-xs">
              <AudioLines className="size-4" />
              <span>开始播放（{filtered.length} 张）</span>
            </Button>
          </div>
        </Card>
      )}

      {phase === "playing" && current && (
        <Card className="px-(--card-spacing) mb-4">
          <div className="mb-3 flex items-center justify-between text-[0.85rem] text-muted-foreground">
            <span>
              第 {playIdx + 1} / {items.length} 张 · {loopAll ? "∞ 无限循环" : "单遍"}{limitMin ? ` · 定时 ${limitMin} 分钟` : ""}
            </span>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <span className="badge">{current.key.startsWith("ar-") ? `讲透文章 · ${current.group}` : current.group ? `演练 · ${current.group}` : current.key.startsWith("fc-m") ? "必会 M" : "重点 K"}</span>
            {current.front && <span className="badge">问：{current.front}</span>}
          </div>
          <div className="mb-5 rounded-[12px] border border-emerald-500/40 bg-emerald-500/10 p-5 text-[1rem] leading-[1.75] whitespace-pre-wrap break-words">
            {current.back}
          </div>
          <div className="btn-row">
            <Button type="button" variant="default" onClick={togglePause} className="gap-1.5">
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {paused ? "继续" : "暂停"}
            </Button>
            <Button type="button" variant="outline" onClick={() => jump(-1)} className="gap-1">
              上一张
            </Button>
            <Button type="button" variant="outline" onClick={() => jump(1)} className="gap-1">
              下一张
            </Button>
            <Button type="button" variant="ghost" onClick={stop} className="gap-1">
              <Square className="size-4" />
              停止
            </Button>
          </div>
          <p className="mt-3 text-[0.78rem] text-muted-foreground">
            播放中请保持本页打开；语音由浏览器合成，语速与发音人可随时在设置中调整。
          </p>
        </Card>
      )}

    </>
  );
}