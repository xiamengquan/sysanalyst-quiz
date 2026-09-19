"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/AuthButton";
import { GlobalSearch } from "@/components/GlobalSearch";

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

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_92%,transparent)] backdrop-blur-md"
        style={{ paddingTop: "var(--safe-t)" }}
      >
        <div
          className="mx-auto flex w-full items-center justify-between gap-2 px-4 py-3.5 sm:gap-3 sm:px-6 sm:py-4 lg:px-8 xl:px-10"
          style={{ maxWidth: "var(--content-max)" }}
        >
          <Link href="/" className="min-w-0 truncate text-[1rem] font-semibold text-[var(--text)]">
            <span className="hidden sm:inline">系统分析师 · 刷题站</span>
            <span className="sm:hidden">系分刷题</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <AuthButton />
            <GlobalSearch />
            <nav className="hidden shrink-0 gap-1 sm:flex" aria-label="主导航">
              {tabs.map((t) => {
                const active = isActive(pathname, t.href);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`rounded-full border px-3.5 py-2 text-[0.88rem] transition ${
                      active
                        ? "border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
                        : "border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:text-[var(--text)]"
                    }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>
            <span className="sm:hidden text-[0.78rem] text-[var(--muted)]">
              {tabs.find((t) => isActive(pathname, t.href))?.label || ""}
            </span>
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_94%,transparent)] backdrop-blur-md sm:hidden"
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
                className={`flex flex-col items-center justify-center gap-0.5 text-[0.72rem] font-medium ${
                  active ? "text-[var(--accent)]" : "text-[var(--muted)]"
                }`}
              >
                <span
                  className={`h-1 w-5 rounded-full ${active ? "bg-[var(--accent)]" : "bg-transparent"}`}
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
