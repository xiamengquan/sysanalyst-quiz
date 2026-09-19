export type ReleaseEntry = {
  version: string;
  date?: string;
  title?: string;
  highlights: string[];
};

/** `/data/release-notes.json`：latest 用于弹窗；releases 为完整更新日志 */
export type ReleaseNotesFile = {
  latest: string;
  releases: ReleaseEntry[];
};

export function pickLatestRelease(data: ReleaseNotesFile | null | undefined): ReleaseEntry | null {
  if (!data?.releases?.length) return null;
  const hit = data.releases.find((r) => r.version === data.latest) || data.releases[0];
  if (!hit?.version || !Array.isArray(hit.highlights) || !hit.highlights.length) return null;
  return hit;
}
