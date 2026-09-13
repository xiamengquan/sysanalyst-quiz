import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "系统分析师 · 刷题站",
  description: "软考系统分析师本地/边缘刷题：选择题、案例分析、知识点精炼",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "系分刷题",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1419",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteHeader />
        <div className="site-main">{children}</div>
        <footer
          className="mx-auto hidden px-6 pb-10 text-[0.8rem] leading-relaxed text-[var(--muted)] sm:block"
          style={{ maxWidth: "var(--content-max)" }}
        >
          个人学习用途 · EdgeOne / 本地均可部署 · 数据来自知识点精炼与出题工坊正式产物
        </footer>
      </body>
    </html>
  );
}
