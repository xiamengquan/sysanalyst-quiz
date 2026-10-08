export type KbBody =
  | { format: "html"; html: string }
  | { format: "markdown"; markdown: string };

function looksLikeErrorPage(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("<!DOCTYPE") || t.startsWith("<html");
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal, cache: "force-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} · ${url}`);
  const text = await res.text();
  if (!text.trim()) throw new Error(`empty body · ${url}`);
  if (looksLikeErrorPage(text)) throw new Error(`unexpected HTML page · ${url}`);
  return text;
}

/**
 * 拉取知识点正文：优先预构建 HTML（/data/kb-html），其次 Markdown（/data/kb-md 或 /kb/path）。
 */
export async function fetchKbBody(
  item: { id: string; path: string },
  signal?: AbortSignal,
): Promise<KbBody> {
  const id = encodeURIComponent(item.id);
  const htmlUrl = `/data/kb-html/${id}.html`;
  const mdUrls = [
    `/data/kb-md/${id}.md`,
    "/kb/" + item.path.split("/").map(encodeURIComponent).join("/"),
  ];

  try {
    const html = await fetchText(htmlUrl, signal);
    return { format: "html", html };
  } catch {
    /* fall through to markdown */
  }

  let lastErr: Error | null = null;
  for (const url of mdUrls) {
    try {
      const markdown = await fetchText(url, signal);
      return { format: "markdown", markdown };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("加载正文失败");
}

/** @deprecated 使用 fetchKbBody；保留供仅需 MD 的场景 */
export async function fetchKbMarkdown(item: { id: string; path: string }, signal?: AbortSignal): Promise<string> {
  const body = await fetchKbBody(item, signal);
  if (body.format === "markdown") return body.markdown;
  throw new Error("预构建 HTML 已存在，无 Markdown 回退");
}
