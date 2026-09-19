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
        className="sticky top-0 z-[70] border-b border-border/80 bg-background/90 backdrop-blur-md"
        style={{ paddingTop: "var(--safe-t)" }}
      >
        <div
          className="mx-auto flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-4 lg:px-8 xl:px-10"
          style={{ maxWidth: "var(--content-max)" }}
        >
          <div className="flex min-w-0 flex-1 items-baseline gap-2 sm:flex-none">
            <Link
              href="/"
              className="min-w-0 truncate text-[0.95rem] font-semibold text-foreground sm:text-[1rem]"
            >
              <span className="hidden sm:inline">系统分析师 · 刷题站</span>
              <span className="sm:hidden">系分刷题</span>
            </Link>
            {currentTab ? (
              <span className="truncate text-[0.78rem] font-medium text-primary sm:hidden" aria-current="page">
                {currentTab.label}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <AuthButton />
            <ThemeToggle />
            <GlobalSearch />
            <nav className="hidden shrink-0 gap-1 sm:flex" aria-label="主导航">
              {tabs.map((t) => {
                const active = isActive(pathname, t.href);
                return (
                  <Button
                    key={t.href}
                    asChild
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("rounded-full px-3.5", active && "text-primary")}
                  >
                    <Link href={t.href}>{t.label}</Link>
                  </Button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/94 backdrop-blur-md sm:hidden"
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
                  "flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[0.72rem] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn("h-1 w-5 rounded-full", active ? "bg-primary" : "bg-transparent")}
                  aria-hidden
                />
                {t.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
