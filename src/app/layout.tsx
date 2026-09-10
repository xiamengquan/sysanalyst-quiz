import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "系统分析师 · 刷题站",
  description: "软考系统分析师本地/边缘刷题：选择题、案例分析、知识点精炼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteHeader />
        <div className="mx-auto max-w-[820px] px-4 pb-20 pt-6">{children}</div>
        <footer className="mx-auto max-w-[820px] px-4 pb-8 text-[0.8rem] leading-relaxed text-[var(--muted)]">
          个人学习用途 · EdgeOne / 本地均可部署 · 数据来自知识点精炼与出题工坊正式产物
        </footer>
      </body>
    </html>
  );
}
