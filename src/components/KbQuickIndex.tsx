"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";

export type KbTocHeading = {
  id: string;
  text: string;
  level: number;
};

type Props = {
  /** 正文容器（.md-body）；流式布局时滚动发生在窗口 */
  bodyRef: RefObject<HTMLDivElement | null>;
  /** 正文 HTML 变化时重建目录 */
  html: string;
  enabled?: boolean;
};

function collectHeadings(root: HTMLElement | null): KbTocHeading[] {
  if (!root) return [];
  const nodes = root.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id]");
  const out: KbTocHeading[] = [];
  nodes.forEach((el) => {
    const id = el.id?.trim();
    if (!id) return;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const tag = el.tagName.toLowerCase();
    const level = tag === "h1" ? 1 : tag === "h2" ? 2 : 3;
    out.push({ id, text, level });
  });
  return out;
}

function usesSelfScroll(el: HTMLElement | null) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const oy = style.overflowY;
  if (oy !== "auto" && oy !== "scroll") return false;
  return el.scrollHeight > el.clientHeight + 8;
}

export function KbQuickIndex({ bodyRef, html, enabled = true }: Props) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [headings, setHeadings] = useState<KbTocHeading[]>([]);
  const [activeId, setActiveId] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) {
      setHeadings([]);
      return;
    }
    const sync = () => setHeadings(collectHeadings(bodyRef.current));
    sync();
    const t = window.setTimeout(sync, 80);
    return () => window.clearTimeout(t);
  }, [bodyRef, html, enabled]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null;
      if (wrapRef.current && t && !wrapRef.current.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  useEffect(() => {
    const box = bodyRef.current;
    if (!box || headings.length === 0) return;

    const updateActive = () => {
      if (usesSelfScroll(box)) {
        const top = box.scrollTop + 28;
        let current = headings[0]?.id || "";
        for (const h of headings) {
          const el = document.getElementById(h.id);
          if (!el || !box.contains(el)) continue;
          const y = el.offsetTop - box.offsetTop;
          if (y <= top) current = h.id;
          else break;
        }
        setActiveId(current);
        return;
      }
      const mark = 96;
      let current = headings[0]?.id || "";
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= mark) current = h.id;
        else break;
      }
      setActiveId(current);
    };

    updateActive();
    if (usesSelfScroll(box)) {
      box.addEventListener("scroll", updateActive, { passive: true });
      return () => box.removeEventListener("scroll", updateActive);
    }
    window.addEventListener("scroll", updateActive, { passive: true });
    return () => window.removeEventListener("scroll", updateActive);
  }, [bodyRef, headings]);

  const scrollTo = useCallback(
    (hid: string) => {
      const box = bodyRef.current;
      const el = document.getElementById(hid);
      if (!el) return;
      if (box && usesSelfScroll(box) && box.contains(el)) {
        box.scrollTo({ top: Math.max(0, el.offsetTop - box.offsetTop - 12), behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      try {
        history.replaceState(null, "", `#${encodeURIComponent(hid)}`);
      } catch {
        /* ignore */
      }
      setActiveId(hid);
      setOpen(false);
    },
    [bodyRef],
  );

  const visible = enabled && headings.length >= 2;
  const summary = useMemo(() => {
    if (!headings.length) return "索引";
    return `索引 · ${headings.length}`;
  }, [headings.length]);

  if (!visible) return null;

  return (
    <div className={`kb-toc-fab${open ? " is-open" : ""}`} ref={wrapRef}>
      {open ? (
        <nav id={panelId} className="kb-toc-panel" aria-label="本页知识点快速索引">
          <div className="kb-toc-panel-hd">
            <span>本页索引</span>
            <button type="button" className="kb-toc-close" onClick={() => setOpen(false)} aria-label="关闭索引">
              关闭
            </button>
          </div>
          <ul className="kb-toc-list">
            {headings.map((h) => (
              <li key={h.id} className={`kb-toc-item lv-${h.level}${activeId === h.id ? " is-active" : ""}`}>
                <button type="button" onClick={() => scrollTo(h.id)} title={h.text}>
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <button
        type="button"
        className="kb-toc-trigger"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "收起" : summary}
      </button>
    </div>
  );
}
