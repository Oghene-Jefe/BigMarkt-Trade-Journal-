"use client";

import { useRef } from "react";
import ReportCardActions from "@/components/reportCard/ReportCardActions";
import type { DayStats } from "@/lib/heatmap";

type Props = {
  date: string;
  stats: DayStats;
  onClose: () => void;
  onViewList: () => void;
};

function formatHuman(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DaySummaryCard({ date, stats, onClose, onViewList }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div
          ref={cardRef}
          className="rounded-lg border border-white/10 bg-panel p-6"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted">
              BigMarkt
            </span>
            <span className="text-xs text-muted">{formatHuman(date)}</span>
          </div>

          <div className="mt-4">
            <div
              className="text-4xl font-bold tabular-nums"
              style={{ color: stats.pnl >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {stats.pnl >= 0 ? "+" : "-"}${Math.abs(stats.pnl).toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-muted">Net P&L for the day</div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-semibold text-white">{stats.total}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted">Trades</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-[#22c55e]">{stats.wins}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted">Wins</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-[#ef4444]">{stats.losses}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted">Losses</div>
            </div>
          </div>
        </div>

        <ReportCardActions cardRef={cardRef} filename={`bigmarkt-${date}.png`} />

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onViewList}
            className="text-sm text-gold hover:underline"
          >
            View full trade list &rarr;
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
