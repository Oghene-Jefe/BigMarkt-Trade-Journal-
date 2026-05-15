"use client";

import { useMemo, useState } from "react";
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
}: {
  trades: TradeRow[];
  chartUrls: Record<string, string>;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
            Clear ×
          </button>
        </div>
      ) : null}

      <div className="flex items-end justify-end">
        <ExportButtons
          trades={filteredTrades}
          isFiltered={selectedDate !== null}
          filterLabel={selectedDate ? formatHuman(selectedDate) : ""}
        />
      </div>

      <JournalTable trades={filteredTrades} chartUrls={chartUrls} />
    </div>
  );
}
