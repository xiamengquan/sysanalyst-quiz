"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { renderKbMarkdown, runMermaidIn } from "@/lib/kb-md";
import {
  flattenKbIndex,
  parseKbHref,
  resolveKbRef,
  type KbFlatItem,
} from "@/lib/kb-resolve";
import type { KbIndex } from "@/lib/types";

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (pinned && onPinnedChange) {
          onPinnedChange(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    // 固钉态不锁滚动，便于对照作答
    if (pinned) {
      return () => window.removeEventListener("keydown", onKey);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, pinned, onPinnedChange]);

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

  if (!open) return null;

  const panel = (
    <aside
      className={`kb-drawer-panel${docked ? " is-docked" : ""}`}
      role="dialog"
      aria-modal={!docked}
      aria-labelledby={titleId}
    >
      <header className="kb-drawer-head">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-[1.05rem] font-semibold leading-snug">
            {item?.title || current?.title || "相关知识点"}
          </h2>
          {contextHint ? (
            <p className="mt-0.5 text-[0.78rem] leading-snug text-[var(--muted)]">{contextHint}</p>
          ) : null}
          {item?.path ? (
            <p className="mt-0.5 truncate text-[0.75rem] text-[var(--muted)]">
              <span className="badge">{item.status || "正式"}</span>
              {docked ? <span className="badge">已固钉</span> : null}
              <code className="text-[0.85em]">{item.path}</code>
            </p>
          ) : null}
        </div>
        <div className="btn-row shrink-0">
          {onPinnedChange ? (
            <button
              type="button"
              className={`btn px-2.5 py-1.5 text-[0.85rem]${pinned ? " btn-primary" : " btn-ghost"}`}
              aria-pressed={pinned}
              title={pinned ? "取消固钉，恢复浮层" : "固钉到内容区右侧"}
              onClick={() => onPinnedChange(!pinned)}
            >
              {pinned ? "取消固钉" : "固钉"}
            </button>
          ) : null}
          {stack.length > 1 ? (
            <button type="button" className="btn btn-ghost px-2.5 py-1.5 text-[0.85rem]" onClick={onBack}>
              返回上篇
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost px-2.5 py-1.5 text-[0.85rem]" onClick={onClose}>
            关闭
          </button>
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
          <div className="space-y-3 text-[0.92rem] leading-relaxed text-[var(--muted)]">
            <p>{emptyHint}</p>
            <Link href="/kb/" className="btn btn-primary inline-flex" onClick={onClose}>
              打开知识点目录
            </Link>
          </div>
        ) : (
          <>
            {status === "loading" && <p className="text-[var(--muted)]">正在加载关联知识点…</p>}
            {status === "err" && <p className="text-[var(--bad)]">{msg}</p>}
            {status === "ok" && <div dangerouslySetInnerHTML={{ __html: html }} />}
          </>
        )}
      </div>
      <footer className="kb-drawer-foot">
        {current ? (
          <Link href={`/kb/${current.id}/`} className="btn btn-primary" onClick={onClose}>
            整页打开
          </Link>
        ) : (
          <Link href="/kb/" className="btn btn-primary" onClick={onClose}>
            打开目录
          </Link>
        )}
      </footer>
    </aside>
  );

  if (docked) {
    return (
      <div className="kb-drawer-root is-docked" role="presentation">
        {panel}
      </div>
    );
  }

  return (
    <div className="kb-drawer-root" role="presentation">
      <button type="button" className="kb-drawer-backdrop" aria-label="关闭预览" onClick={onClose} />
      {panel}
    </div>
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
