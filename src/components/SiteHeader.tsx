"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/AuthButton";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "刷题", short: "刷题" },
  { href: "/case/", label: "案例", short: "案例" },
  { href: "/kb/", label: "知识点", short: "知识" },
  { href: "/changelog/", label: "更新", short: "更新" },
  { href: "/about/", label: "关于", short: "关于" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const currentTab = tabs.find((t) => isActive(pathname, t.href));

  return (
    <>
      <header
        className="sticky top-0 z-[70] border-b border-border/70 bg-background/80 backdrop-blur-md"
        style={{ paddingTop: "var(--safe-t)" }}
      >
        <div
          className="mx-auto flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3 lg:px-8 xl:px-10"
          style={{ maxWidth: "var(--content-max)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="group flex min-w-0 items-center gap-2.5 text-foreground transition-opacity hover:opacity-85"
            >
              {/* Cursor-style 几何标识 */}
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/90 bg-card shadow-xs transition-colors group-hover:border-foreground/30">
                <svg
                  className="size-3.5 text-foreground"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <span className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-[0.95rem]">
                <span className="hidden sm:inline">系统分析师 · 刷题站</span>
                <span className="sm:hidden">系分刷题</span>
              </span>
            </Link>
            {currentTab ? (
              <span className="hidden rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground md:inline">
                {currentTab.label}
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <nav
              className="hidden shrink-0 items-center gap-1 rounded-full border border-border/70 bg-surface/50 p-0.5 sm:flex"
              aria-label="主导航"
            >
              {tabs.map((t) => {
                const active = isActive(pathname, t.href);
                return (
                  <Button
                    key={t.href}
                    asChild
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-7 rounded-full px-3 text-xs font-medium transition-all",
                      active
                        ? "border-border/80 bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                    )}
                  >
                    <Link href={t.href}>{t.label}</Link>
                  </Button>
                );
              })}
            </nav>
            <div className="h-4 w-px bg-border/80 hidden sm:block mx-1" />
            <GlobalSearch />
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/90 backdrop-blur-md sm:hidden"
        style={{ paddingBottom: "var(--safe-b)" }}
        aria-label="底部导航"
      >
        <div
          className="mx-auto grid grid-cols-5"
          style={{ height: "var(--tabbar-h)", maxWidth: "var(--content-max)" }}
        >
          {tabs.map((t) => {
            const active = isActive(pathname, t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "relative flex min-h-[44px] flex-col items-center justify-center gap-1 text-[0.72rem] font-medium transition-colors",
                  active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <span
                    className="absolute top-0 h-0.5 w-6 rounded-full bg-foreground"
                    aria-hidden
                  />
                )}
                {t.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
