"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "../(auth)/actions";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/ui/Logo";

type Props = {
  admin: boolean;
  unreadCount: number;
  userEmail: string;
};

// Desktop nav is grouped into four click-to-open dropdown menus + a
// profile menu. Reduces the visible top-bar count from 12 to 4, while
// keeping every destination one extra click away (better than 12 items
// fighting for space and visual hierarchy).
//
// Groupings:
//   Trading  — your own activity (dashboard, journal, trades, analytics, challenges)
//   Compete  — other traders (leaderboard, subscriptions)
//   Connect  — external data sources (brokers, accounts, ea setup, exchanges)
//   Profile  — your account (profile, admin-if-admin, logout)
//
// Mobile drawer is unchanged — it's already a scrollable list of all 12+
// destinations, and the hamburger replaces the top-bar density problem
// at narrow widths.

type LinkItem = { href: Route; label: string };

const GROUPS: { label: string; items: LinkItem[] }[] = [
  {
    label: "Trading",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/journal", label: "Journal" },
      { href: "/calculator", label: "Risk Calc" },
      { href: "/trades", label: "Trades" },
      { href: "/analytics", label: "Analytics" },
      { href: "/challenges", label: "Challenges" },
    ],
  },
  {
    label: "Compete",
    items: [
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/subscriptions", label: "Subscriptions" },
    ],
  },
  {
    label: "Connect",
    items: [
      { href: "/brokers", label: "Broker Guide" },
      { href: "/accounts", label: "Accounts" },
      { href: "/ea-setup", label: "EA Setup" },
      // "Exchanges" (Bybit) is intentionally hidden from the nav while
      // the Vercel → Bybit geo-block is unresolved. Routes stay live
      // (/exchanges, /exchanges/new) for direct-URL access by admins
      // and ops. See INFRASTRUCTURE.md → Hidden features.
      // { href: "/exchanges", label: "Exchanges" },
    ],
  },
];

// Mobile drawer uses the flat list (everything in one scrollable column).
const MOBILE_LINKS: LinkItem[] = GROUPS.flatMap((g) => g.items).concat([
  { href: "/profile", label: "Profile" },
]);

export default function DrawerNav({ admin, unreadCount, userEmail }: Props) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Escape to close drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Escape closes desktop dropdown too
  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMenu]);

  // Click-outside closes the open dropdown
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!openMenu) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenu]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const groupHasActive = (items: LinkItem[]) => items.some((i) => isActive(i.href));

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
      {/* Desktop nav — grouped dropdowns */}
      <nav ref={navRef} className="hidden items-center gap-2 text-sm md:flex">
        {GROUPS.map((g) => (
          <DesktopMenu
            key={g.label}
            label={g.label}
            items={g.items}
            isOpen={openMenu === g.label}
            onToggle={() => setOpenMenu(openMenu === g.label ? null : g.label)}
            onClose={() => setOpenMenu(null)}
            active={groupHasActive(g.items)}
            isActive={isActive}
          />
        ))}

        {/* Profile menu — separate from the four content groups */}
        <DesktopMenu
          label={admin ? "Profile ★" : "Profile"}
          items={[{ href: "/profile", label: "Profile" }, ...(admin ? [{ href: "/admin" as Route, label: "Admin" }, { href: "/admin/support" as Route, label: "Support Inbox" }] : [])]}
          isOpen={openMenu === "__profile"}
          onToggle={() => setOpenMenu(openMenu === "__profile" ? null : "__profile")}
          onClose={() => setOpenMenu(null)}
          active={isActive("/profile") || isActive("/admin")}
          isActive={isActive}
          footer={
            <>
              <div className="border-t border-white/10 px-3 py-2">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Theme</p>
                <ThemeToggle variant="stacked" />
              </div>
              <div className="border-t border-white/10 px-3 py-2 text-xs text-muted">{userEmail}</div>
              <form action={logoutAction} className="border-t border-white/10 px-3 py-2">
                <button className="w-full rounded-md border border-white/20 px-3 py-1.5 text-xs">
                  Log out
                </button>
              </form>
            </>
          }
        />

        <Bell />
      </nav>

      {/* Mobile header right cluster */}
      <div className="flex items-center gap-4 md:hidden">
        <Bell />
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls="mobile-drawer"
          onClick={() => setDrawerOpen(true)}
          className="text-2xl leading-none text-white"
        >
          ☰
        </button>
      </div>

      {/* Drawer overlay + panel (mobile only) */}
      {drawerOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setDrawerOpen(false)}
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
              <Bell onNavigate={() => setDrawerOpen(false)} />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="text-2xl leading-none text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex justify-center py-4 border-b border-gold/20">
              <Logo size="md" />
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {MOBILE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`flex min-h-[48px] w-full items-center px-4 ${
                    isActive(l.href) ? "text-gold" : "text-muted hover:text-white"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              {admin ? (
                <>
                  <Link
                    href="/admin"
                    onClick={() => setDrawerOpen(false)}
                    className={`flex min-h-[48px] w-full items-center px-4 ${
                      isActive("/admin") && !isActive("/admin/support") ? "text-gold" : "text-gold/80 hover:text-white"
                    }`}
                  >
                    Admin
                  </Link>
                  <Link
                    href={"/admin/support" as Route}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex min-h-[48px] w-full items-center px-4 ${
                      isActive("/admin/support") ? "text-gold" : "text-gold/80 hover:text-white"
                    }`}
                  >
                    Support Inbox
                  </Link>
                </>
              ) : null}
            </nav>
            <div className="space-y-3 border-t border-white/10 p-4">
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Theme</p>
                <ThemeToggle variant="stacked" />
              </div>
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

// Single dropdown menu — used for each of the 4 groups + the profile menu.
// Click the trigger to open, click outside or press Escape to close, click
// a child link to navigate (which also closes via onClose).
function DesktopMenu({
  label,
  items,
  isOpen,
  onToggle,
  onClose,
  active,
  isActive,
  footer,
}: {
  label: string;
  items: LinkItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  active: boolean;
  isActive: (href: string) => boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${
          active ? "text-gold" : "text-muted hover:text-white"
        }`}
      >
        {label}
        <span className="text-xs">▾</span>
      </button>
      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-md border border-white/10 bg-panel shadow-lg"
        >
          <ul className="py-1">
            {items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={onClose}
                  role="menuitem"
                  className={`block px-3 py-2 text-sm ${
                    isActive(i.href) ? "text-gold" : "text-muted hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
