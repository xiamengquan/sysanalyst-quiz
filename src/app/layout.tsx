import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { ThemeProvider } from "@/components/theme-provider";
import { UpdateNotice } from "@/components/UpdateNotice";
import { PortalHost } from "@/components/portal";
import { cn } from "@/lib/utils";

/** 拉丁数字优先走此字体，配合 tabular-nums */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex",
});

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#1a222c" },
  ],
};

const themeBootScript = `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='dark'||(t!=='light'&&(t==='system'||!t)&&d)?'dark':'light';var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(r);e.style.colorScheme=r;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={cn(plexSans.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <SiteHeader />
          <div className="site-main">{children}</div>
          <footer
            className="mx-auto hidden w-full px-6 pb-10 text-[0.8rem] leading-relaxed text-muted-foreground sm:block lg:px-8 xl:px-10"
            style={{ maxWidth: "var(--content-max)" }}
          >
            个人学习用途 · EdgeOne / 本地均可部署 · 数据来自知识点精炼与出题工坊正式产物
          </footer>
          <PortalHost />
          <UpdateNotice />
        </ThemeProvider>
      </body>
    </html>
  );
}
