"use client";

import { useEffect, useState } from "react";
import { pickLatestRelease, type ReleaseEntry, type ReleaseNotesFile } from "@/lib/release-notes";

export function ChangelogApp() {
  const [releases, setReleases] = useState<ReleaseEntry[]>([]);
  const [latest, setLatest] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/data/release-notes.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("加载失败"))))
      .then((data: ReleaseNotesFile) => {
        if (cancelled) return;
        const list = Array.isArray(data.releases) ? data.releases : [];
        setReleases(list);
        setLatest(pickLatestRelease(data)?.version || data.latest || "");
      })
      .catch(() => {
        if (!cancelled) setError("暂时无法加载更新日志");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <h1 className="page-title">更新日志</h1>
      <p className="page-lead">历次部署的变更说明。新版本首次打开站点时也会弹窗提示。</p>

      {error ? <p className="text-[0.9rem] text-red-400">{error}</p> : null}

      {!error && !releases.length ? (
        <p className="text-[0.9rem] text-[var(--muted)]">加载中…</p>
      ) : null}

      <div className="stack-loose">
        {releases.map((r) => {
          const isLatest = r.version === latest;
          return (
            <article
              key={r.version}
              className="card mb-0 space-y-3"
              id={`v${r.version.replace(/\./g, "-")}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[1.05rem] font-medium text-[var(--text)]">
                  {r.title || `v${r.version}`}
                  {isLatest ? (
                    <span className="badge ml-2 align-middle text-[0.72rem]">当前</span>
                  ) : null}
                </h2>
                <span
                  className="text-[0.8rem] text-[var(--muted)]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  v{r.version}
                  {r.date ? ` · ${r.date}` : ""}
                </span>
              </div>
              <ul className="m-0 list-disc space-y-2 pl-5 text-[0.92rem] leading-relaxed text-[var(--muted)]">
                {r.highlights.map((h) => (
                  <li key={h} className="text-[var(--text)]">
                    {h}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </>
  );
}
