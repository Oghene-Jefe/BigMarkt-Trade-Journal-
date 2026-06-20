"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TradeRow } from "@/lib/types";
import JournalTable from "@/components/JournalTable";
import MonthlyHeatmap from "@/components/heatmap/MonthlyHeatmap";
import ExportButtons from "@/components/journal/ExportButtons";

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHuman(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function JournalClient({
  trades,
  chartUrls,
  violationCounts = {},
}: {
  trades: TradeRow[];
  chartUrls: Record<string, string>;
  violationCounts?: Record<string, number>;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const router = useRouter();

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const refresh = setInterval(() => {
      router.refresh();
      setLastUpdated(new Date());
      setSecondsAgo(0);
    }, 30_000);
    return () => clearInterval(refresh);
  }, [router]);

  // Tick the "last updated X seconds ago" counter every second
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1_000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const filteredTrades = useMemo(() => {
    if (!selectedDate) return trades;
    return trades.filter(
      (t) => t.created_at && toLocalDateKey(t.created_at) === selectedDate,
    );
  }, [trades, selectedDate]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/10 bg-panel p-4">
        <MonthlyHeatmap
          trades={trades}
          onDayClick={setSelectedDate}
          selectedDate={selectedDate}
        />
      </div>

      {selectedDate ? (
        <div className="flex items-center justify-between rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-sm text-gold">
          <span>Showing trades for {formatHuman(selectedDate)}</span>
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="font-medium hover:text-white"
          >
            Clear Ã—
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <ExportButtons
          trades={filteredTrades}
          isFiltered={selectedDate !== null}
          filterLabel={selectedDate ? formatHuman(selectedDate) : ""}
        />
        <Link
          href="/journal/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-black hover:bg-gold/90"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New trade
        </Link>
      </div>

      <div className="flex justify-end">
        <span className="text-xs text-muted">
          Last updated {secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`}
        </span>
      </div>

      <JournalTable trades={filteredTrades} chartUrls={chartUrls} violationCounts={violationCounts} />
    </div>
  );
}
