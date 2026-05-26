"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Trophy, Cpu, User } from "lucide-react";
import type { Route } from "next";

type NavTab = {
  href: Route;
  label: string;
  icon: React.ReactNode;
};

const TABS: NavTab[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={20} aria-hidden />,
  },
  {
    href: "/journal",
    label: "Journal",
    icon: <BookOpen size={20} aria-hidden />,
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: <Trophy size={20} aria-hidden />,
  },
  {
    href: "/ea-setup",
    label: "EA Setup",
    icon: <Cpu size={20} aria-hidden />,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: <User size={20} aria-hidden />,
  },
];

export default function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-panel md:hidden">
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] font-medium transition-colors ${
                  active ? "text-gold" : "text-muted hover:text-white"
                }`}
              >
                <span className={active ? "text-gold" : ""}>{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
