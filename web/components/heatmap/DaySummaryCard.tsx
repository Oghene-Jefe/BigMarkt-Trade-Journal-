"use client";

import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Logo from "@/components/ui/Logo";
import ReportCardActions from "@/components/reportCard/ReportCardActions";
import type { DayStats } from "@/lib/heatmap";

type Props = {
  date: string;
  stats: DayStats;
  onClose: () => void;
  onViewList: () => void;
};

const GOLD = "#D4AF37";
const WIN = "#22C55E";
const LOSS = "#EF4444";
const DARK = "#0a0a0a";
const PANEL = "#141414";
const MUTED = "#888888";

function formatHuman(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StatCell({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-md p-2.5" style={{ backgroundColor: PANEL }}>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-lg" style={{ color: color ?? "#FFFFFF" }}>
        {value}
      </div>
    </div>
  );
}

export default function DaySummaryCard({ date, stats, onClose, onViewList }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pnlColor = stats.pnl > 0 ? WIN : stats.pnl < 0 ? LOSS : MUTED;
  const pnlPrefix = stats.pnl > 0 ? "+" : "";

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-sm space-y-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black text-white/70 hover:border-white/40 hover:text-white"
        >
          <X size={16} aria-hidden />
        </button>
        <div
          ref={cardRef}
          style={{ backgroundColor: DARK, borderColor: `${GOLD}33` }}
          className="rounded-lg border p-6 text-white"
        >
          {/* HEADER — matches TradeCard exactly */}
          <div className="flex items-center justify-between gap-3">
            <Logo size="sm" />
            <span className="text-sm font-mono" style={{ color: GOLD }}>
              DAILY SUMMARY
            </span>
          </div>

          {/* HERO */}
          <div className="mt-5">
            <div
              className="font-mono text-4xl font-bold tracking-wide"
              style={{ color: pnlColor }}
            >
              {pnlPrefix}${Math.abs(stats.pnl).toFixed(2)}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
              Net P&L for the day
            </div>
          </div>

          {/* STATS — same bordered-cell grid as TradeCard */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <StatCell label="Trades" value={stats.total} />
            <StatCell label="Wins" value={stats.wins} color={WIN} />
            <StatCell label="Losses" value={stats.losses} color={LOSS} />
          </div>

          {/* FOOTER — matches TradeCard exactly */}
          <div
            className="mt-6 flex items-center justify-between border-t pt-3 text-[11px]"
            style={{ borderColor: `${GOLD}33` }}
          >
            <span style={{ color: MUTED }}>{formatHuman(date)}</span>
            <span className="font-mono tracking-wide" style={{ color: `${GOLD}AA` }}>
              journal.bigmarkt.co
            </span>
          </div>
        </div>

        <ReportCardActions cardRef={cardRef} filename={`bigmarkt-${date}`} />

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onViewList}
            className="text-sm hover:underline"
            style={{ color: GOLD }}
          >
            View full trade list &rarr;
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
