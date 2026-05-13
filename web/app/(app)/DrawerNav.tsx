"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "../(auth)/actions";

type Props = {
  admin: boolean;
  unreadCount: number;
  userEmail: string;
};

const LINKS: { href: Route; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/journal", label: "Journal" },
  { href: "/trades", label: "Trades" },
  { href: "/analytics", label: "Analytics" },
  { href: "/challenges", label: "Challenges" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/brokers", label: "Broker Guide" },
  { href: "/accounts", label: "Accounts" },
  { href: "/ea-setup", label: "EA Setup" },
  { href: "/exchanges", label: "Exchanges" },
  { href: "/profile", label: "Profile" },
];

export default function DrawerNav({ admin, unreadCount, userEmail }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const Bell = ({ onNavigate }: { onNavigate?: () => void }) => (
    <Link
      href="/notifications"
      onClick={onNavigate}
      className="relative text-muted hover:text-white"
      aria-label="Notifications"
    >
      <span className="text-base">🔔</span>
      {unreadCount > 0 ? (
        <span className="absolute -right-2 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );

  return (
    <>
      {/* Desktop nav — unchanged from the original layout */}
      <nav className="hidden items-center gap-5 text-sm md:flex">
        <Link href="/dashboard" className="text-muted hover:text-white">Dashboard</Link>
        <Link href="/journal" className="text-muted hover:text-white">Journal</Link>
        <Link href="/trades" className="text-muted hover:text-white">Trades</Link>
        <Link href="/analytics" className="text-muted hover:text-white">Analytics</Link>
        <Link href="/challenges" className="text-muted hover:text-white">Challenges</Link>
        <Link href="/leaderboard" className="text-muted hover:text-white">Leaderboard</Link>
        <Link href="/subscriptions" className="text-muted hover:text-white">Subscriptions</Link>
        <Link href="/brokers" className="text-muted hover:text-white">Broker Guide</Link>
        <Link href="/accounts" className="text-muted hover:text-white">Accounts</Link>
        <Link href="/ea-setup" className="text-muted hover:text-white">EA Setup</Link>
        <Link href="/exchanges" className="text-muted hover:text-white">Exchanges</Link>
        <Link href="/profile" className="text-muted hover:text-white">Profile</Link>
        {admin ? <Link href="/admin" className="text-gold hover:text-white">Admin</Link> : null}
        <Bell />
        <span className="hidden text-xs text-muted md:inline">{userEmail}</span>
        <form action={logoutAction}>
          <button className="rounded-md border border-white/20 px-3 py-1 text-xs">Log out</button>
        </form>
      </nav>

      {/* Mobile header right cluster */}
      <div className="flex items-center gap-4 md:hidden">
        <Bell />
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-drawer"
          onClick={() => setOpen(true)}
          className="text-2xl leading-none text-white"
        >
          ☰
        </button>
      </div>

      {/* Drawer overlay + panel (mobile only) */}
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed right-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-l border-white/10 bg-panel md:hidden"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <Bell onNavigate={() => setOpen(false)} />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="text-2xl leading-none text-white"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-[48px] w-full items-center px-4 ${
                    isActive(l.href) ? "text-gold" : "text-muted hover:text-white"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              {admin ? (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className={`flex min-h-[48px] w-full items-center px-4 ${
                    isActive("/admin") ? "text-gold" : "text-gold/80 hover:text-white"
                  }`}
                >
                  Admin
                </Link>
              ) : null}
            </nav>
            <div className="border-t border-white/10 p-4">
              <form action={logoutAction}>
                <button className="w-full rounded-md border border-white/20 px-3 py-2 text-sm">
                  Log out
                </button>
              </form>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
