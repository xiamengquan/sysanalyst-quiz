"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import type { KbIndex, KbItem } from "@/lib/types";

export function KbCatalog() {
  const [data, setData] = useState<KbIndex | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/data/kb-index.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-[var(--bad)]">目录加载失败：{err}</p>;
  if (!data) return <p className="text-[var(--muted)]">正式目录加载中…</p>;

  return (
    <>
      <h1 className="mb-1 text-[1.35rem] font-semibold">知识点</h1>
      <p className="mb-4 text-[0.9rem] text-[var(--muted)]">
        正式发布 {data.meta?.version || "v1.0"} · 点击条目在站内阅读正文
      </p>
      <div className="card mb-4 border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--panel))] text-[0.92rem] leading-relaxed">
        <b>正式发布 {data.meta?.version || "v1.0"}</b>（{data.meta?.effective || "—"}）
        ：审计通过内容；可站内阅读，也可跳转对应章节刷题。
      </div>
      {data.sections.map((sec) => (
        <div key={sec.id} className="mb-4">
          <h3 className="mb-2 text-[0.95rem] text-[var(--muted)]">{sec.title}</h3>
          <ul className="space-y-2">
            {sec.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/kb/${item.id}/`}
                  className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[#121820] px-3.5 py-3 hover:border-[#4a5d73]"
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
    </>
  );
}

export function KbReader({ id }: { id: string }) {
  const [item, setItem] = useState<KbItem | null>(null);
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");
  const [msg, setMsg] = useState("");
  const map = useMemo(() => new Map<string, KbItem>(), []);

  useEffect(() => {
    fetch("/data/kb-index.json")
      .then((r) => r.json())
      .then((data: KbIndex) => {
        for (const sec of data.sections || []) {
          for (const it of sec.items || []) map.set(it.id, it);
        }
        const found = map.get(id) || null;
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
        const url = "/kb/" + found.path.split("/").map(encodeURIComponent).join("/");
        return fetch(url).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const md = await res.text();
          marked.setOptions({ gfm: true, breaks: false });
          setHtml(marked.parse(md) as string);
          setStatus("ok");
        });
      })
      .catch((e) => {
        setStatus("err");
        setMsg(e.message);
      });
  }, [id, map]);

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Link href="/kb/" className="btn btn-ghost">
          返回目录
        </Link>
        {item?.chapter ? (
          <Link href={`/?chapter=${item.chapter}&bank=practice`} className="btn btn-primary">
            在本章刷题（第{String(item.chapter).padStart(2, "0")}章）
          </Link>
        ) : null}
      </div>
      <div className="card">
        <h1 className="mb-2 text-[1.2rem] font-semibold">{item?.title || id}</h1>
        {item?.path ? (
          <p className="mb-2 text-[0.85rem] text-[var(--muted)]">
            <span className="badge">{item.status || "正式"}</span>
            <code className="text-[0.8em]">{item.path}</code>
          </p>
        ) : null}
        {item?.note ? <p className="mb-2 text-[0.85rem] text-[var(--muted)]">{item.note}</p> : null}
        {status === "loading" && <p className="text-[var(--muted)]">正在加载正文…</p>}
        {status === "err" && <p className="text-[var(--bad)]">{msg}</p>}
        {status === "ok" && <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
    </>
  );
}
