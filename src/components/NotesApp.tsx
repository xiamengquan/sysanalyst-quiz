"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type NoteItem = {
  id: string;
  no: number;
  title: string;
  subtitle: string;
  kind: string;
  duration: string;
  published: string;
  video: string;
  summary: string;
};

type NotesIndex = { source?: string; items: NoteItem[] };

function kindLabel(no: number, kind: string) {
  if (no === 0) return "汇编";
  return `第 ${no} 讲 · ${kind}`;
}

export function NotesApp() {
  const [index, setIndex] = useState<NotesIndex | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = index?.items ?? [];
  const selected = items.find((it) => it.id === selectedId) ?? null;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/data/notes-index.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as NotesIndex;
        if (!alive) return;
        setIndex(data);
        // 默认选中：桌面端直接打开第一篇（总复习手册）
        const hash = decodeURIComponent(window.location.hash.slice(1));
        const initial = data.items.find((it) => it.id === hash) ?? data.items[0];
        if (initial) setSelectedId(initial.id);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadBody = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/data/notes-md/${encodeURIComponent(id)}.md`, {
        cache: "no-cache",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setMarkdown(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMarkdown("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setHtml("");
    void loadBody(selectedId);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${selectedId}`);
    }
  }, [selectedId, loadBody]);

  useEffect(() => {
    if (!markdown) return;
    let alive = true;
    (async () => {
      const { marked } = await import("marked");
      const raw = marked.parse(markdown, { async: false }) as string;
      // 外链新开页
      const out = raw.replace(/<a\s+href="http/g, '<a target="_blank" rel="noopener noreferrer" href="http');
      if (alive) setHtml(out);
    })();
    return () => {
      alive = false;
    };
  }, [markdown]);

  const list = (
    <nav aria-label="笔记目录" className="flex flex-col gap-1">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => setSelectedId(it.id)}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-left transition-colors touch-manipulation",
            it.id === selectedId
              ? "border-foreground/60 bg-muted/60"
              : "border-border/60 hover:bg-muted/40",
          )}
        >
          <span className="flex items-center gap-2">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-[0.9rem] font-medium text-foreground">{it.title}</span>
            <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.66rem] text-muted-foreground">
              {it.no === 0 ? "汇编" : `第${it.no}讲`}
            </span>
          </span>
          <span className="mt-1 line-clamp-1 block text-[0.75rem] text-muted-foreground">
            {it.subtitle}
          </span>
        </button>
      ))}
    </nav>
  );

  return (
    <div
      className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-10"
      style={{ maxWidth: "var(--content-max)" }}
    >
      <div className="max-w-2xl">
        <p className="text-[0.72rem] font-medium uppercase tracking-widest text-muted-foreground">
          系统分析师 · 案例分析
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          视频笔记
        </h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
          《案例分析通关》8 讲视频内容的完整整理笔记：方法论、四大专题、网站架构演化与真题带练，
          每篇附答题模板、常见失分与章节时间轴。
        </p>
      </div>

      {error && (
        <Card className="mt-6 border-destructive/40 p-4 text-sm text-destructive">
          加载失败：{error}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => selectedId && void loadBody(selectedId)}>
            <RefreshCw className="mr-1 size-3.5" /> 重试
          </Button>
        </Card>
      )}

      {/* 移动端：未选中时看目录；桌面端固定双栏 */}
      <div className="mt-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
        <aside className={cn("lg:block", selected && "hidden lg:block")}>
          {index ? (
            list
          ) : error ? null : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 加载目录…
            </div>
          )}
        </aside>

        <main className={cn("mt-6 min-w-0 lg:mt-0", !selected && "hidden lg:block")}>
          {selected && (
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="mr-1 size-3.5" /> 返回目录
              </Button>
              <div className="mt-2 flex flex-wrap items-center gap-2 lg:mt-0">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {selected.title}
                </h2>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">
                  {kindLabel(selected.no, selected.kind)}
                </span>
                {selected.duration && (
                  <span className="text-[0.75rem] text-muted-foreground">视频 {selected.duration}</span>
                )}
                {selected.video && (
                  <a
                    href={selected.video}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    原视频 <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className="mt-1 text-[0.85rem] text-muted-foreground">{selected.summary}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 加载正文…
            </div>
          ) : html ? (
            <article
              className="md-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
