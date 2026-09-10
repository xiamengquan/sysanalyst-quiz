"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "刷题" },
  { href: "/case/", label: "案例" },
  { href: "/kb/", label: "知识点" },
  { href: "/about/", label: "关于" },
];

export function SiteHeader() {
  const pathname = usePathname() || "/";
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[820px] items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="truncate text-[1rem] font-semibold text-[var(--text)]">
          <span className="hidden sm:inline">系统分析师 · 刷题站</span>
          <span className="sm:hidden">系分刷题</span>
        </Link>
        <nav className="flex shrink-0 gap-1" aria-label="主导航">
          {tabs.map((t) => {
            const active =
              t.href === "/"
                ? pathname === "/"
                : pathname === t.href || pathname.startsWith(t.href);
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
      </div>
    </header>
  );
}
