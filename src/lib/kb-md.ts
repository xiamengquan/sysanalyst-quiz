import { marked, Renderer } from "marked";
import {
  isKbMarkdownHref,
  looksLikeKbPath,
  resolveKbRef,
  resolveRelativeKbPath,
  type KbFlatItem,
} from "@/lib/kb-resolve";

export function decodeHtmlEntities(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 将可解析的书名号《…》换成关联锚点（避开已在标签属性内的情况，简化：仅处理纯文本片段） */
function linkifyBookTitles(html: string, items: KbFlatItem[], excludeId?: string) {
  return html.replace(/《([^》{]{2,80})》/g, (full, title: string) => {
    const hit = resolveKbRef(items, title, { excludeId });
    if (!hit) return full;
    return `<a href="/kb/${escapeAttr(hit.id)}/" class="kb-ref" data-kb-id="${escapeAttr(hit.id)}" title="预览：${escapeAttr(hit.title)}">《${escapeHtml(title)}》</a>`;
  });
}

/** 将正文里指向 *.md 的相对/文件名链接 rewrite 为站内 /kb/{id}/ */
function linkifyMarkdownFileAnchors(
  html: string,
  items: KbFlatItem[],
  excludeId?: string,
  currentItemPath?: string,
) {
  return html.replace(
    /<a\s+([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, before, href, after, inner) => {
      // marked 会把 href 中的非 ASCII 字符 percent-encode；先还原成原文再查路由树
      let decoded = String(href).trim();
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        /* 保留原串 */
      }
      if (!isKbMarkdownHref(decoded)) return full;
      let query = decoded;
      if (currentItemPath && (decoded.startsWith("./") || decoded.startsWith("../"))) {
        query = resolveRelativeKbPath(currentItemPath, decoded);
      }
      const hit = resolveKbRef(items, query, { excludeId });
      if (!hit) return full;
      const titleAttr = hit.title ? ` title="预览：${escapeAttr(hit.title)}"` : "";
      return `<a href="/kb/${escapeAttr(hit.id)}/" class="kb-ref" data-kb-id="${escapeAttr(hit.id)}"${titleAttr}>${inner}</a>`;
    },
  );
}

/**
 * Markdown → HTML；可识别的 `` `*.md` `` / 路径 codespan、书名号转为 `.kb-ref`。
 * 内嵌 raw HTML 块（<figure>/<svg> 等）先提取占位：CommonMark 的 HTML block
 * 在块内 blank line（含含空格的伪空行）处截断，会打断多行内嵌图示。
 */
const RAW_BLOCK_PLACEHOLDER_RE = /<p>\s*KBRAWBLOCK(\d+)\s*<\/p>|KBRAWBLOCK(\d+)/g;

function extractRawHtmlBlocks(md: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  const text = md.replace(/<(figure|svg|pre)[\s\S]*?<\/\1>/gi, (raw) => {
    const idx = blocks.push(raw) - 1;
    return `\n\nKBRAWBLOCK${idx}\n\n`;
  });
  return { text, blocks };
}

function restoreRawHtmlBlocks(html: string, blocks: string[]): string {
  return html.replace(RAW_BLOCK_PLACEHOLDER_RE, (_m, a, b) => {
    const idx = Number(a ?? b);
    return blocks[idx] ?? _m;
  });
}

export function renderKbMarkdown(md: string, items: KbFlatItem[] = [], excludeId?: string) {
  const { text: sourceMd, blocks: rawBlocks } = extractRawHtmlBlocks(md);
  const renderer = new Renderer();
  renderer.heading = ({ text, depth }) => {
    const plain = String(text).replace(/<[^>]+>/g, "");
    const id = plain
      .trim()
      .toLowerCase()
      .replace(/[`*_~]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^\w\u4e00-\u9fff-]+/g, "")
      .slice(0, 80);
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  renderer.codespan = ({ text }) => {
    const raw = String(text);
    if (looksLikeKbPath(raw)) {
      const hit = resolveKbRef(items, raw, { excludeId });
      if (hit) {
        return `<a href="/kb/${escapeAttr(hit.id)}/" class="kb-ref" data-kb-id="${escapeAttr(hit.id)}" data-kb-path="${escapeAttr(raw)}" title="预览：${escapeAttr(hit.title)}"><code>${escapeHtml(raw)}</code></a>`;
      }
    }
    return `<code>${escapeHtml(raw)}</code>`;
  };
  marked.setOptions({ gfm: true, breaks: false });
  let html = marked.parse(sourceMd, { renderer }) as string;
  html = restoreRawHtmlBlocks(html, rawBlocks);
  html = html.replace(/<table[\s\S]*?<\/table>/gi, (table) => `<div class="table-wrap">${table}</div>`);
  html = html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi,
    (_m, code) => `<div class="mermaid-wrap"><div class="mermaid">${decodeHtmlEntities(code)}</div></div>`,
  );
  if (items.length) {
    const currentPath = excludeId ? items.find((it) => it.id === excludeId)?.path : undefined;
    html = linkifyMarkdownFileAnchors(html, items, excludeId, currentPath);
    html = linkifyBookTitles(html, items, excludeId);
  }
  return html;
}

let mermaidMod: typeof import("mermaid").default | null = null;
let mermaidLoader: Promise<typeof import("mermaid").default> | null = null;

export function ensureMermaid() {
  if (mermaidMod) return Promise.resolve(mermaidMod);
  if (mermaidLoader) return mermaidLoader;
  mermaidLoader = import("mermaid").then((m) => {
    const mermaid = m.default;
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "strict",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    });
    mermaidMod = mermaid;
    return mermaid;
  });
  return mermaidLoader;
}

export async function runMermaidIn(root: ParentNode | null) {
  if (!root) return;
  const nodes = root.querySelectorAll<HTMLElement>(".mermaid");
  if (!nodes.length) return;
  const mermaid = await ensureMermaid();
  nodes.forEach((n) => n.removeAttribute("data-processed"));
  await mermaid.run({ nodes: Array.from(nodes) });
}
