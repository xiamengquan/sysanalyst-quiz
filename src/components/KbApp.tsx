"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { KbIndex, KbItem } from "@/lib/types";
import { filterCatalogItems } from "@/lib/kb-search";
import { renderKbMarkdown, runMermaidIn } from "@/lib/kb-md";
import { parseKbHref, resolveKbRef } from "@/lib/kb-resolve";
import { KbPreviewDrawer, useKbCatalog } from "@/components/KbPreviewDrawer";
import { KbQuickIndex } from "@/components/KbQuickIndex";
import { GlobalSearchHintButton } from "@/components/GlobalSearch";

const KIND_OPTS = [
  { value: "all", label: "全部类型" },
  { value: "chapter", label: "章节" },
  { value: "quick", label: "速查" },
  { value: "appendix", label: "附录" },
  { value: "index", label: "篇索引" },
  { value: "entry", label: "入口" },
];

export function KbCatalog() {
  const [data, setData] = useState<KbIndex | null>(null);
  const [err, setErr] = useState("");
  const [kind, setKind] = useState("all");
  const [sectionId, setSectionId] = useState("all");

  useEffect(() => {
    fetch("/data/kb-index.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  const flat = useMemo(() => {
    if (!data) return [];
    return data.sections.flatMap((sec) =>
      (sec.items || []).map((item) => ({
        ...item,
        sectionId: sec.id,
        sectionTitle: sec.title,
      })),
    );
  }, [data]);

  const catalogFiltered = useMemo(
    () => filterCatalogItems(flat, "", kind, sectionId),
    [flat, kind, sectionId],
  );

  const grouped = useMemo(() => {
    if (!data) return [];
    return data.sections
      .map((sec) => ({
        ...sec,
        items: catalogFiltered.filter((i) => i.sectionId === sec.id),
      }))
      .filter((sec) => sec.items.length > 0 && (sectionId === "all" || sec.id === sectionId));
  }, [data, catalogFiltered, sectionId]);

  if (err) return <p className="text-[var(--bad)]">目录加载失败：{err}</p>;
  if (!data) return <p className="text-[var(--muted)]">正式目录加载中…</p>;

  return (
    <>
      <h1 className="page-title">知识点</h1>
      <p className="page-lead">
        正式发布 {data.meta?.version || "v1.0"} · 全文搜索请用顶栏或{" "}
        <kbd className="gs-kbd-inline">Ctrl+K</kbd> / <kbd className="gs-kbd-inline">⌘K</kbd>
      </p>

      <div className="layout-split">
        <aside className="layout-aside" aria-label="知识点筛选">
          <div className="card space-y-4">
            <h2 className="text-[1rem] font-medium">筛选</h2>
            <p className="text-[0.85rem] leading-relaxed text-[var(--muted)]">
              按类型 / 分区浏览；搜标题与正文请用全局搜索。
            </p>
            <div className="filter-stack">
              <label className="block text-[0.82rem] text-[var(--muted)]">
                类型
                <select className="field mt-1.5" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {KIND_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[0.82rem] text-[var(--muted)]">
                篇/分区
                <select
                  className="field mt-1.5"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                >
                  <option value="all">全部</option>
                  {data.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.85rem] text-[var(--muted)]">
                显示 {catalogFiltered.length} / {flat.length}
              </p>
              <GlobalSearchHintButton />
            </div>
          </div>
        </aside>

        <div className="layout-main">
          <div className="card mb-4 border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--panel))] text-[0.92rem] leading-relaxed">
            <b>正式发布 {data.meta?.version || "v1.0"}</b>（{data.meta?.effective || "—"}）
            ：审计通过内容；可站内阅读，也可跳转对应章节刷题。正文内关联知识点以抽屉预览。
          </div>

          {grouped.map((sec) => (
            <div key={sec.id} className="mb-6">
              <h3 className="mb-3 text-[0.95rem] font-medium tracking-wide text-[var(--muted)]">
                {sec.title}
              </h3>
              <ul className="list-gap">
                {sec.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/kb/${item.id}/`}
                      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[#121820] px-4 py-4 hover:border-[#4a5d73]"
                    >
                      <div>
                        <div className="text-[0.95rem]">{item.title}</div>
                        {item.note ? (
                          <div className="mt-0.5 text-[0.78rem] text-[var(--muted)]">{item.note}</div>
                        ) : null}
                      </div>
                      <span className="badge shrink-0">{item.status || "正式"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function KbReader({ id }: { id: string }) {
  const catalog = useKbCatalog();
  const [item, setItem] = useState<KbItem | null>(null);
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState("");
  const [stack, setStack] = useState<{ id: string; title: string }[]>([]);
  const [kbPinned, setKbPinned] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const previewOpen = stack.length > 0;

  useEffect(() => {
    if (!catalog.length) return;
    const found = catalog.find((it) => it.id === id) || null;
    setItem(found);
    if (!found) {
      setStatus("err");
      setMsg("未找到该知识点条目");
      return;
    }
    if (!found.path || found.path.endsWith("/")) {
      setStatus("err");
      setMsg("该项为目录入口，请选择具体章节阅读。");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    const url = "/kb/" + found.path.split("/").map(encodeURIComponent).join("/");
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const md = await res.text();
        if (cancelled) return;
        setHtml(renderKbMarkdown(md, catalog, found.id));
        setStatus("ok");
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus("err");
        setMsg(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, catalog]);

  useEffect(() => {
    if (status !== "ok") return;
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!hash) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(decodeURIComponent(hash));
      const box = bodyRef.current;
      if (!el) return;
      if (box && box.contains(el)) {
        const style = window.getComputedStyle(box);
        const nested =
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          box.scrollHeight > box.clientHeight + 8;
        if (nested) {
          box.scrollTop = el.offsetTop - box.offsetTop - 12;
          return;
        }
      }
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [status, html]);

  useEffect(() => {
    if (status !== "ok" || !html.includes('class="mermaid"')) return;
    void runMermaidIn(bodyRef.current).catch(() => {});
  }, [status, html]);

  const openPreview = useCallback(
    (targetId: string) => {
      if (targetId === id) {
        setToast("已在当前页阅读该篇");
        window.setTimeout(() => setToast(""), 2200);
        return;
      }
      const hit = catalog.find((c) => c.id === targetId);
      if (!hit) {
        setToast("未找到对应知识点");
        window.setTimeout(() => setToast(""), 2200);
        return;
      }
      setStack((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id === targetId) return prev;
        return [...prev, { id: hit.id, title: hit.title }];
      });
    },
    [catalog, id],
  );

  const onBodyClick = useCallback(
    (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
      if (!a) return;
      const kbId = a.getAttribute("data-kb-id");
      if (kbId) {
        e.preventDefault();
        openPreview(kbId);
        return;
      }
      const path = a.getAttribute("data-kb-path");
      if (path) {
        e.preventDefault();
        const hit = resolveKbRef(catalog, path, { excludeId: id });
        if (hit) openPreview(hit.id);
        else {
          setToast("未找到对应知识点");
          window.setTimeout(() => setToast(""), 2200);
        }
        return;
      }
      const href = a.getAttribute("href") || "";
      const parsed = parseKbHref(href);
      if (parsed && catalog.some((c) => c.id === parsed.id)) {
        e.preventDefault();
        openPreview(parsed.id);
      }
    },
    [catalog, id, openPreview],
  );

  return (
    <>
      <div className={`kb-dock-layout${previewOpen && kbPinned ? " is-docked" : ""}`}>
        <div className="kb-dock-main">
          <article className="kb-reader layout-full">
            <header className="kb-reader-head">
              <h1>{item?.title || id}</h1>
              {item?.path ? (
                <p className="mb-3 break-all text-[0.8rem] leading-relaxed text-[var(--muted)] sm:text-[0.85rem]">
                  <span className="badge">{item.status || "正式"}</span>
                  <code className="text-[0.8em]">{item.path}</code>
                </p>
              ) : null}
              {item?.note ? (
                <p className="text-[0.88rem] leading-relaxed text-[var(--muted)]">{item.note}</p>
              ) : null}
            </header>

            {status === "loading" && <p className="text-[var(--muted)]">正在加载正文…</p>}
            {status === "err" && <p className="text-[var(--bad)]">{msg}</p>}
            {status === "ok" && (
              <div
                ref={bodyRef}
                className="md-body is-fluid"
                onClick={onBodyClick}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
          </article>
        </div>
        {previewOpen && kbPinned ? (
          <KbPreviewDrawer
            open
            pinned
            onPinnedChange={setKbPinned}
            stack={stack}
            catalog={catalog}
            onClose={() => setStack([])}
            onBack={() => setStack((s) => s.slice(0, -1))}
            onOpenRef={openPreview}
          />
        ) : null}
      </div>

      <nav className="kb-nav-fab" aria-label="阅读页快捷操作">
        {item?.chapter ? (
          <Link href={`/?chapter=${item.chapter}&bank=practice`} className="kb-fab-btn is-primary">
            本章刷题
          </Link>
        ) : null}
        <Link href="/kb/" className="kb-fab-btn">
          返回目录
        </Link>
      </nav>

      {status === "ok" ? <KbQuickIndex bodyRef={bodyRef} html={html} /> : null}

      {toast ? <div className="kb-toast" role="status">{toast}</div> : null}

      {previewOpen && !kbPinned ? (
        <KbPreviewDrawer
          open
          pinned={false}
          onPinnedChange={setKbPinned}
          stack={stack}
          catalog={catalog}
          onClose={() => setStack([])}
          onBack={() => setStack((s) => s.slice(0, -1))}
          onOpenRef={openPreview}
        />
      ) : null}
    </>
  );
}
