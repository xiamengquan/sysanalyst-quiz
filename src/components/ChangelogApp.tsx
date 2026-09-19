"use client";

import { useEffect, useState } from "react";
import { pickLatestRelease, type ReleaseEntry, type ReleaseNotesFile } from "@/lib/release-notes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!error && !releases.length ? <p className="text-sm text-muted-foreground">加载中…</p> : null}

      <div className="stack-loose">
        {releases.map((r) => {
          const isLatest = r.version === latest;
          return (
            <Card key={r.version} id={`v${r.version.replace(/\./g, "-")}`} className="mb-0">
              <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 space-y-0">
                <CardTitle className="text-lg font-medium">
                  {r.title || `v${r.version}`}
                  {isLatest ? <Badge className="ml-2 align-middle">当前</Badge> : null}
                </CardTitle>
                <span className="text-sm text-muted-foreground tabular-nums">
                  v{r.version}
                  {r.date ? ` · ${r.date}` : ""}
                </span>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-[0.92rem] leading-relaxed text-muted-foreground">
                  {r.highlights.map((h) => (
                    <li key={h} className="text-foreground">
                      {h}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
