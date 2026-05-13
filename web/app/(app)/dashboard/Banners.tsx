"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";

const STORAGE_KEY = "bigmarkt_banner_dismissed";

type Props = {
  journalMode: "manual" | "automated" | null;
  brokerAccountCount: number;
  tradeCount: number;
};

export default function Banners({ journalMode, brokerAccountCount, tradeCount }: Props) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDismissed(JSON.parse(raw));
    } catch {
      // Ignore — fresh slate on parse error.
    }
    setHydrated(true);
  }, []);

  function dismiss(key: string) {
    const next = Array.from(new Set([...dismissed, key]));
    setDismissed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable — banner just won't persist its dismissal.
    }
  }

  if (!hydrated) return null;

  const banners: { key: string; href: string; text: string }[] = [];
  if (
    journalMode === "automated" &&
    brokerAccountCount === 0 &&
    !dismissed.includes("connect_broker")
  ) {
    banners.push({
      key: "connect_broker",
      href: "/ea-setup",
      text: "Connect your broker to start auto-capturing trades →",
    });
  }
  if (
    journalMode === "manual" &&
    tradeCount === 0 &&
    !dismissed.includes("first_trade")
  ) {
    banners.push({
      key: "first_trade",
      href: "/journal/new",
      text: "Log your first trade →",
    });
  }

  if (banners.length === 0) return null;

  return (
    <div className="space-y-2">
      {banners.map((b) => (
        <div
          key={b.key}
          className="flex items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3"
        >
          <Link href={b.href as Route} className="text-sm text-gold hover:underline">
            {b.text}
          </Link>
          <button
            type="button"
            onClick={() => dismiss(b.key)}
            aria-label="Dismiss"
            className="text-lg leading-none text-gold/70 hover:text-gold"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
