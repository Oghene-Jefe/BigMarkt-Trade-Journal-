"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { TradeRow } from "@/lib/types";
import JournalTable from "@/components/JournalTable";
import MonthlyHeatmap from "@/components/heatmap/MonthlyHeatmap";
import ExportButtons from "@/components/journal/ExportButtons";
import ManualTradeForm from "@/components/journal/ManualTradeForm";

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
  defaultAccountId,
}: {
  trades: TradeRow[];
  chartUrls: Record<string, string>;
  defaultAccountId?: string | null;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  // A counter we increment on success to force a page refresh hint
  const [, setRefreshKey] = useState(0);
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

  const handleManualSuccess = useCallback(() => {
    setShowManualForm(false);
    setRefreshKey((k) => k + 1);
    // Trigger a soft reload so the new trade appears
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

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
        {defaultAccountId ? (
          <button
            type="button"
            onClick={() => setShowManualForm(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-black hover:bg-gold/90"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add Manual Trade
          </button>
        ) : null}
      </div>

      {/* Manual trade modal */}
      {showManualForm && defaultAccountId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowManualForm(false); }}
        >
          <div className="relative w-full max-w-2xl rounded-xl border border-white/10 bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Add Manual Trade</h2>
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="rounded p-1 text-muted hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto">
              <ManualTradeForm
                brokerAccountId={defaultAccountId}
                onSuccess={handleManualSuccess}
                onCancel={() => setShowManualForm(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <span className="text-xs text-muted">
          Last updated {secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`}
        </span>
      </div>

      <JournalTable trades={filteredTrades} chartUrls={chartUrls} />
    </div>
  );
}
