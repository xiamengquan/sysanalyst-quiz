"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/portal";
import { pickLatestRelease, type ReleaseEntry, type ReleaseNotesFile } from "@/lib/release-notes";

const SEEN_KEY = "sysanalyst_release_seen";

function readSeen(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(version: string) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(SEEN_KEY, version);
  } catch {
    /* ignore */
  }
}

/**
 * 新部署版本首次打开时弹出更新说明。
 * 数据源：`/data/release-notes.json`（发版时改 latest + releases）。
 */
export function UpdateNotice() {
  const titleId = useId();
  const [notes, setNotes] = useState<ReleaseEntry | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/data/release-notes.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ReleaseNotesFile | null) => {
        if (cancelled) return;
        const latest = pickLatestRelease(data);
        if (!latest) return;
        const seen = readSeen();
        if (seen === latest.version) return;
        setNotes(latest);
        setOpen(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    if (notes?.version) writeSeen(notes.version);
    setOpen(false);
  };

  if (!notes) return null;

  return (
    <Modal open={open} onClose={dismiss} labelledBy={titleId}>
      <div className="flex flex-col gap-3 p-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={titleId} className="text-[1.05rem] font-semibold text-[var(--text)]">
            {notes.title || "站点更新"}
          </h2>
          <span className="text-[0.78rem] text-[var(--muted)]" style={{ fontVariantNumeric: "tabular-nums" }}>
            v{notes.version}
            {notes.date ? ` · ${notes.date}` : ""}
          </span>
        </div>
        <p className="text-[0.85rem] leading-relaxed text-[var(--muted)]">本版更新要点：</p>
        <ul className="m-0 list-disc space-y-2 pl-5 text-[0.9rem] leading-relaxed text-[var(--text)]">
          {notes.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Link
            href="/changelog/"
            className="text-[0.85rem] text-[var(--accent)] underline-offset-2 hover:underline"
            onClick={dismiss}
          >
            查看全部更新日志
          </Link>
          <button
            type="button"
            className="rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-4 py-2 text-[0.88rem] text-[var(--accent)]"
            onClick={dismiss}
          >
            知道了
          </button>
        </div>
      </div>
    </Modal>
  );
}
