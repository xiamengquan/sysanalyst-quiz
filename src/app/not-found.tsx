import Link from "next/link";

/** 静态导出 404：避免托管把未知路径 fallback 到首页时用户误以为是「只有刷题」 */
export default function NotFound() {
  return (
    <div
      className="mx-auto px-4 py-16 text-center"
      style={{ maxWidth: "var(--content-max)" }}
    >
      <h1 className="text-lg font-semibold text-foreground">页面不存在</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        链接可能已更名或缺少末尾斜杠（本站知识点 URL 形如{" "}
        <code className="text-xs">/kb/quick-web-case/</code>）。
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/kb/"
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          打开知识点目录
        </Link>
        <Link
          href="/"
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          返回刷题
        </Link>
      </div>
    </div>
  );
}
