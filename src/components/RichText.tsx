"use client";

import type { ReactNode } from "react";

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/** 纯文本 + 行内 markdown 图片 `![](url)`（真题外链配图）。 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(IMG_RE.source, "g");
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${m.index}-${m[2]}`}
        src={m[2]}
        alt={m[1] || "配图"}
        className="my-2 max-h-[480px] w-auto max-w-full rounded-md border border-border bg-white"
        loading="lazy"
        referrerPolicy="no-referrer"
      />,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return (
    <div className={className ?? "whitespace-pre-wrap break-words"}>
      {nodes.length ? nodes : text}
    </div>
  );
}
