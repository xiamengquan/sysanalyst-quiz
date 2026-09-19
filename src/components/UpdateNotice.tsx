"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

export function UpdateNotice() {
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
        if (readSeen() === latest.version) return;
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) dismiss();
        else setOpen(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline justify-between gap-2 pr-6">
            <span>{notes.title || "站点更新"}</span>
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              v{notes.version}
              {notes.date ? ` · ${notes.date}` : ""}
            </span>
          </DialogTitle>
          <DialogDescription>本版更新要点：</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {notes.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <DialogFooter className="flex-row flex-wrap items-center justify-between gap-2 sm:justify-between">
          <Button variant="link" className="h-auto px-0" asChild>
            <Link href="/changelog/" onClick={dismiss}>
              查看全部更新日志
            </Link>
          </Button>
          <Button onClick={dismiss}>知道了</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
