"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Search } from "lucide-react";
import { searchKbDocs, type KbSearchHit, type KbSearchIndex } from "@/lib/kb-search";
import { dialogMobileSheetClassName } from "@/lib/dialog-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const KIND_OPTS = [
  { value: "all", label: "全部类型" },
  { value: "chapter", label: "章节" },
  { value: "quick", label: "速查" },
  { value: "appendix", label: "附录" },
  { value: "index", label: "篇索引" },
  { value: "entry", label: "入口" },
];

const QUICK_LINKS = [
  { href: "/", label: "刷题", hint: "选择题练习" },
  { href: "/case/", label: "案例", hint: "案例分析" },
  { href: "/kb/", label: "知识点", hint: "精炼目录" },
  { href: "/changelog/", label: "更新日志", hint: "历次发版要点" },
  { href: "/about/", label: "关于", hint: "说明与合规" },
];

export const OPEN_GLOBAL_SEARCH = "sysanalyst:open-search";

export function openGlobalSearch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_SEARCH));
  }
}

function hitLabel(kind: string) {
  if (kind === "title") return "目录";
  if (kind === "heading") return "标题";
  return "正文";
}

function isModK(e: KeyboardEvent) {
  return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
}

type ResultRow =
  | { type: "nav"; href: string; label: string; hint: string }
  | { type: "kb"; hit: KbSearchHit; href: string };

export function GlobalSearch() {
  const router = useRouter();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [sectionId, setSectionId] = useState("all");
  const [searchIdx, setSearchIdx] = useState<KbSearchIndex | null>(null);
  const [sections, setSections] = useState<{ id: string; title: string }[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modHint, setModHint] = useState("Ctrl+K");

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const openModal = useCallback(() => {
    setOpen(true);
    setActive(0);
  }, []);

  useEffect(() => {
    setModHint(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl+K");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isModK(e)) return;
      e.preventDefault();
      setOpen((v) => {
        if (v) {
          setQuery("");
          setActive(0);
          return false;
        }
        return true;
      });
    };
    const onOpen = () => openModal();
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_GLOBAL_SEARCH, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_GLOBAL_SEARCH, onOpen);
    };
  }, [openModal]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || searchIdx) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/data/kb-search-index.json").then((r) => (r.ok ? r.json() : null)),
      fetch("/data/kb-index.json").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([idx, catalog]) => {
        if (cancelled) return;
        if (idx?.docs) setSearchIdx(idx);
        if (catalog?.sections) {
          setSections(
            catalog.sections.map((s: { id: string; title: string }) => ({
              id: s.id,
              title: s.title,
            })),
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, searchIdx]);

  const q = query.trim();

  const kbHits = useMemo((): KbSearchHit[] => {
    if (!q || !searchIdx?.docs?.length) return [];
    return searchKbDocs(searchIdx.docs, q, kind, sectionId, 30);
  }, [q, searchIdx, kind, sectionId]);

  const rows = useMemo((): ResultRow[] => {
    const navAll = QUICK_LINKS.map((l) => ({
      type: "nav" as const,
      href: l.href,
      label: l.label,
      hint: l.hint,
    }));
    if (!q) return navAll;

    const nav = navAll.filter(
      (l) =>
        l.label.includes(q) ||
        l.hint.includes(q) ||
        l.href.toLowerCase().includes(q.toLowerCase()),
    );
    const kb = kbHits.map((hit) => ({
      type: "kb" as const,
      hit,
      href: hit.slug ? `/kb/${hit.id}/#${hit.slug}` : `/kb/${hit.id}/`,
    }));
    return [...nav, ...kb];
  }, [q, kbHits]);

  useEffect(() => {
    setActive(0);
  }, [query, kind, sectionId]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) go(row.href);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const indexed = useMemo(() => {
    const nav = rows.filter((r) => r.type === "nav");
    const kb = rows.filter((r) => r.type === "kb");
    let i = 0;
    return {
      nav: nav.map((row) => ({ row, i: i++ })),
      kb: kb.map((row) => ({ row, i: i++ })),
    };
  }, [rows]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gs-trigger size-9 rounded-full p-0 touch-manipulation sm:size-auto sm:h-9 sm:min-h-9 sm:px-3 sm:gap-2"
        onClick={openModal}
        aria-label="打开搜索"
        title={`${modHint} 搜索`}
      >
        <Search size={15} strokeWidth={2} aria-hidden />
        <span className="gs-trigger-label hidden sm:inline">搜索</span>
        <kbd className="gs-kbd hidden sm:inline-block">{modHint}</kbd>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
          else openModal();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className={cn(
            "gs-dialog z-[90] gap-0 overflow-hidden p-0",
            dialogMobileSheetClassName,
            "sm:top-[min(12vh,5rem)] sm:left-1/2 sm:w-[min(560px,calc(100vw-1.5rem))] sm:max-w-[560px] sm:-translate-x-1/2 sm:translate-y-0",
          )}
          aria-describedby={undefined}
        >
          <DialogTitle id={titleId} className="sr-only">
            全局搜索
          </DialogTitle>
          <DialogDescription className="sr-only">搜索知识点或跳转页面</DialogDescription>

          <div className="gs-hd">
            <Input
              ref={inputRef}
              className="gs-input h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="搜知识点、标题、正文，或跳转页面…"
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button type="button" variant="ghost" size="sm" className="gs-esc shrink-0" onClick={close}>
              Esc
            </Button>
          </div>

          <div className="gs-filters">
            <select
              className="gs-select"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="类型"
            >
              {KIND_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="gs-select"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              aria-label="篇/分区"
            >
              <option value="all">全部篇/分区</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          <div className="gs-body" ref={listRef}>
            {loading && !searchIdx ? (
              <p className="gs-empty">索引加载中…</p>
            ) : rows.length === 0 ? (
              <p className="gs-empty">无匹配，试试「分片」「架构」或章节号「12」</p>
            ) : (
              <ul className="gs-list">
                {indexed.nav.length > 0 ? (
                  <>
                    <li className="gs-group">{q ? "页面" : "快捷入口"}</li>
                    {indexed.nav.map(({ row, i }) => {
                      if (row.type !== "nav") return null;
                      return (
                        <li key={`nav-${row.href}`}>
                          <button
                            type="button"
                            data-idx={i}
                            className={`gs-item${active === i ? " is-active" : ""}`}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => go(row.href)}
                          >
                            <span className="gs-item-title">{row.label}</span>
                            <span className="gs-item-meta">{row.hint}</span>
                          </button>
                        </li>
                      );
                    })}
                  </>
                ) : null}
                {indexed.kb.length > 0 ? (
                  <>
                    <li className="gs-group">知识点</li>
                    {indexed.kb.map(({ row, i }) => {
                      if (row.type !== "kb") return null;
                      const { hit } = row;
                      return (
                        <li key={`kb-${hit.id}-${hit.hitKind}-${hit.heading || ""}-${i}`}>
                          <button
                            type="button"
                            data-idx={i}
                            className={`gs-item${active === i ? " is-active" : ""}`}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => go(row.href)}
                          >
                            <span className="gs-item-title">{hit.title}</span>
                            <span className="gs-item-meta">
                              <span className="badge">{hitLabel(hit.hitKind)}</span>
                              {hit.sectionTitle}
                              {hit.heading ? ` · ${hit.heading}` : ""}
                            </span>
                            {hit.snippet ? <span className="gs-item-snip">{hit.snippet}</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </>
                ) : null}
              </ul>
            )}
          </div>

          <div className="gs-ft">
            <span>↑↓ 选择</span>
            <span>Enter 打开</span>
            <span>{modHint} 开关</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GlobalSearchHintButton({ className = "" }: { className?: string }) {
  return (
    <Button type="button" variant="ghost" className={className} onClick={openGlobalSearch}>
      打开搜索
    </Button>
  );
}
