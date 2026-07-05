"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TradeRow } from "@/lib/types";
import MonthlyHeatmap from "@/components/heatmap/MonthlyHeatmap";
import DaySummaryCard from "@/components/heatmap/DaySummaryCard";
import { groupTradesByDay } from "@/lib/heatmap";

export default function CalendarClient({ trades }: { trades: TradeRow[] }) {
  const router = useRouter();
  const [openDate, setOpenDate] = useState<string | null>(null);
  const byDay = groupTradesByDay(trades);

  return (
    <>
      <MonthlyHeatmap
        trades={trades}
        selectedDate={null}
        onDayClick={(date) => setOpenDate(date)}
      />
      {openDate && byDay[openDate] ? (
        <DaySummaryCard
          date={openDate}
          stats={byDay[openDate]}
          onClose={() => setOpenDate(null)}
          onViewList={() => router.push(`/journal?date=${openDate}`)}
        />
      ) : null}
    </>
  );
}
