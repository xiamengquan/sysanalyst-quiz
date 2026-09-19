"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ExternalLink, Pin, PinOff, X } from "lucide-react";
import { renderKbMarkdown, runMermaidIn } from "@/lib/kb-md";
import {
  flattenKbIndex,
  parseKbHref,
  resolveKbRef,
  type KbFlatItem,
} from "@/lib/kb-resolve";
import type { KbIndex } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEscapeKey } from "@/lib/use-escape-key";

type StackEntry = { id: string; title: string };

export type KbRelatedChip = {
  id: string;
  title: string;
  reason?: string;
};

type Props = {
  open: boolean;
  stack: StackEntry[];
  catalog: KbFlatItem[];
  onClose: () => void;
  onBack: () => void;
  onOpenRef: (id: string) => void;
  /** 本题相关条目，用于抽屉内切换 */
  related?: KbRelatedChip[];
  /** 上下文说明，如「本题 · SRS · 第11章」 */
  contextHint?: string;
  emptyHint?: string;
  /** 固钉：作为内容区右侧栏，而非遮罩浮层 */
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
};

function DrawerChrome({
  titleId,
  item,
  current,
  contextHint,
  docked,
  pinned,
  onPinnedChange,
  hidePin = false,
  stack,
  onBack,
  onClose,
  related,
  onOpenRef,
  bodyRef,
  onBodyClick,
  emptyHint,
  status,
  msg,
  html,
}: {
  titleId: string;
  item: KbFlatItem | null;
  current: StackEntry | null;
  contextHint?: string;
  docked: boolean;
  pinned: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  /** 窄屏隐藏固钉 */
  hidePin?: boolean;
  stack: StackEntry[];
  onBack: () => void;
  onClose: () => void;
  related: KbRelatedChip[];
  onOpenRef: (id: string) => void;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  onBodyClick: (e: MouseEvent) => void;
  emptyHint: string;
  status: "idle" | "loading" | "ok" | "err";
  msg: string;
  html: string;
}) {
  return (
    <>
      <header className="kb-drawer-head">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-[1.05rem] font-semibold leading-snug">
            {item?.title || current?.title || "相关知识点"}
          </h2>
          {contextHint ? (
            <p className="mt-0.5 text-[0.78rem] leading-snug text-muted-foreground">{contextHint}</p>
          ) : null}
          {item?.path ? (
            <p className="mt-0.5 truncate text-[0.75rem] text-muted-foreground">
              <Badge variant="secondary" className="mr-1 align-middle">
                {item.status || "正式"}
              </Badge>
              {docked ? (
                <Badge variant="secondary" className="mr-1 align-middle">
                  已固钉
                </Badge>
              ) : null}
              <code className="text-[0.85em]">{item.path}</code>
            </p>
          ) : null}
        </div>
        <div className="btn-row shrink-0">
          {onPinnedChange && !hidePin ? (
            <Button
              type="button"
              variant={pinned ? "default" : "ghost"}
              size="sm"
              className="hidden min-h-11 gap-1 px-2.5 sm:inline-flex sm:min-h-0"
              aria-pressed={pinned}
              title={pinned ? "取消固钉，恢复浮层" : "固钉到内容区右侧"}
              onClick={() => onPinnedChange(!pinned)}
            >
              {pinned ? <PinOff size={16} strokeWidth={2} aria-hidden /> : <Pin size={16} strokeWidth={2} aria-hidden />}
              <span className="hidden sm:inline">{pinned ? "取消固钉" : "固钉"}</span>
            </Button>
          ) : null}
          {stack.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 gap-1 px-2.5 sm:min-h-0"
              onClick={onBack}
              title="返回上篇"
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">返回</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 touch-manipulation sm:size-8"
            onClick={onClose}
            aria-label="关闭"
            title="关闭"
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </Button>
        </div>
      </header>

      {related.length > 0 ? (
        <div className="kb-drawer-related" aria-label="本题相关知识点">
          {related.map((r) => {
            const active = current?.id === r.id;
            return (
              <button
                key={r.id}
                type="button"
                className={`kb-related-chip${active ? " is-active" : ""}`}
                title={r.reason || r.title}
                onClick={() => onOpenRef(r.id)}
              >
                <span className="kb-related-chip-title">{r.title}</span>
                {r.reason ? <span className="kb-related-chip-reason">{r.reason}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div ref={bodyRef} className="kb-drawer-body md-body" onClick={onBodyClick}>
        {!current ? (
          <div className="space-y-3 text-[0.92rem] leading-relaxed text-muted-foreground">
            <p>{emptyHint}</p>
            <Button asChild>
              <Link href="/kb/" onClick={onClose}>
                打开知识点目录
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {status === "loading" && <p className="text-muted-foreground">正在加载关联知识点…</p>}
            {status === "err" && <p className="text-destructive">{msg}</p>}
            {status === "ok" && <div dangerouslySetInnerHTML={{ __html: html }} />}
          </>
        )}
      </div>
      <footer className="kb-drawer-foot">
        {current ? (
          <Button asChild>
            <Link href={`/kb/${current.id}/`} onClick={onClose}>
              <ExternalLink size={16} strokeWidth={2} aria-hidden />
              整页打开
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/kb/" onClick={onClose}>
              打开目录
            </Link>
          </Button>
        )}
      </footer>
    </>
  );
}

export function KbPreviewDrawer({
  open,
  stack,
  catalog,
  onClose,
  onBack,
  onOpenRef,
  related = [],
  contextHint,
  emptyHint = "暂无与本题直接关联的知识点，可前往目录浏览。",
  pinned = false,
  onPinnedChange,
}: Props) {
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const current = stack[stack.length - 1] || null;
  const item = current ? catalog.find((c) => c.id === current.id) || null : null;
  const docked = open && pinned;

  const [html, setHtml] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false,
  );
  const [viewportReady, setViewportReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => {
      setIsMobile(mq.matches);
      setViewportReady(true);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (isMobile && pinned && onPinnedChange) onPinnedChange(false);
  }, [isMobile, pinned, onPinnedChange]);

  useEffect(() => {
    if (!open || !item?.path) {
      setStatus("idle");
      setHtml("");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setMsg("");
    const url = "/kb/" + item.path.split("/").map(encodeURIComponent).join("/");
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const md = await res.text();
        if (cancelled) return;
        setHtml(renderKbMarkdown(md, catalog, item.id));
        setStatus("ok");
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus("err");
        setMsg(e.message || "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [open, item?.id, item?.path, catalog]);

  useEffect(() => {
    if (!open || status !== "ok" || !html.includes('class="mermaid"')) return;
    void runMermaidIn(bodyRef.current).catch(() => {});
  }, [open, status, html]);

  const onEscape = useCallback(() => {
    if (pinned && onPinnedChange) {
      onPinnedChange(false);
      return;
    }
    onClose();
  }, [pinned, onPinnedChange, onClose]);

  useEscapeKey(docked, onEscape);

  const onBodyClick = useCallback(
    (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
      if (!a) return;
      const kbId = a.getAttribute("data-kb-id");
      if (kbId) {
        e.preventDefault();
        onOpenRef(kbId);
        return;
      }
      const href = a.getAttribute("href") || "";
      const parsed = parseKbHref(href);
      if (parsed && catalog.some((c) => c.id === parsed.id)) {
        e.preventDefault();
        onOpenRef(parsed.id);
      }
    },
    [catalog, onOpenRef],
  );

  const chrome = (
    <DrawerChrome
      titleId={titleId}
      item={item}
      current={current}
      contextHint={contextHint}
      docked={docked}
      pinned={pinned}
      onPinnedChange={onPinnedChange}
      hidePin={isMobile}
      stack={stack}
      onBack={onBack}
      onClose={onClose}
      related={related}
      onOpenRef={onOpenRef}
      bodyRef={bodyRef}
      onBodyClick={onBodyClick}
      emptyHint={emptyHint}
      status={status}
      msg={msg}
      html={html}
    />
  );

  if (docked) {
    return (
      <div className="kb-drawer-root is-docked" role="presentation">
        <aside
          className="kb-drawer-panel is-docked"
          role="dialog"
          aria-modal={false}
          aria-labelledby={titleId}
        >
          {chrome}
        </aside>
      </div>
    );
  }

  /* 等视口判定后再挂 Sheet，避免窄屏首帧按右侧全高打开导致顶栏/抽屉头被盖住 */
  if (!viewportReady) return null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton={false}
        overlayClassName={
          isMobile
            ? "z-[55] bg-black/25 dark:bg-black/45"
            : "z-[55] top-[calc(var(--safe-t)+3.75rem)] bg-black/20 dark:bg-black/45"
        }
        className={
          isMobile
            ? "kb-drawer-panel z-[60] gap-0 border-border bg-card p-0 text-card-foreground max-h-[min(88dvh,720px)] rounded-t-2xl pb-[max(0.5rem,var(--safe-b))]"
            : "kb-drawer-panel z-[60] w-full gap-0 border-border bg-card p-0 text-card-foreground sm:max-w-md data-[side=right]:inset-y-auto data-[side=right]:top-[calc(var(--safe-t)+3.75rem)] data-[side=right]:bottom-0 data-[side=right]:h-[calc(100dvh-var(--safe-t)-3.75rem)]"
        }
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{item?.title || current?.title || "相关知识点"}</SheetTitle>
          <SheetDescription>{contextHint || "知识点预览"}</SheetDescription>
        </SheetHeader>
        {chrome}
      </SheetContent>
    </Sheet>
  );
}

/** 加载目录并提供 openById / openByRef */
export function useKbCatalog() {
  const [catalog, setCatalog] = useState<KbFlatItem[]>([]);
  useEffect(() => {
    fetch("/data/kb-index.json")
      .then((r) => r.json())
      .then((data: KbIndex) => setCatalog(flattenKbIndex(data.sections || [])))
      .catch(() => setCatalog([]));
  }, []);
  return catalog;
}

export function resolveOpenTarget(
  catalog: KbFlatItem[],
  raw: string,
  excludeId?: string,
): KbFlatItem | null {
  return resolveKbRef(catalog, raw, { excludeId });
}
