"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { GUIDE_NAV } from "@/lib/guide/nav";

export default function GuideShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  const NavList = () => (
    <nav className="space-y-6">
      {GUIDE_NAV.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href as Route}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md px-3 py-1.5 text-sm ${
                    isActive(item.href)
                      ? "bg-gold/10 font-medium text-gold"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden">
        <Link href="/guide">
          <Logo size="sm" />
        </Link>
        <button
          type="button"
          aria-label="Open guide navigation"
          onClick={() => setOpen(true)}
          className="text-white"
        >
          <Menu size={22} aria-hidden />
        </button>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6 md:py-10">
        <aside className="hidden w-64 shrink-0 md:block">
          <Link href="/guide" className="mb-6 flex items-center gap-2">
            <Logo size="md" />
          </Link>
          <Link
            href="/dashboard"
            className="mb-6 inline-block text-xs text-muted hover:text-white"
          >
            &larr; Back to app
          </Link>
          <NavList />
        </aside>

        {open ? (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setOpen(false)}
            />
            <div className="relative z-10 h-full w-72 max-w-[85vw] overflow-y-auto border-r border-white/10 bg-panel p-4">
              <div className="mb-4 flex items-center justify-between">
                <Logo size="sm" />
                <button
                  type="button"
                  aria-label="Close guide navigation"
                  onClick={() => setOpen(false)}
                  className="text-white"
                >
                  <X size={20} aria-hidden />
                </button>
              </div>
              <Link
                href="/dashboard"
                className="mb-4 inline-block text-xs text-muted hover:text-white"
              >
                &larr; Back to app
              </Link>
              <NavList />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}
