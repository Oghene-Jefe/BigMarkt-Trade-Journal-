"use client";

import { useRouter } from "next/navigation";
import type { TradeRow } from "@/lib/types";
import MonthlyHeatmap from "@/components/heatmap/MonthlyHeatmap";

export default function CalendarClient({ trades }: { trades: TradeRow[] }) {
  const router = useRouter();

  return (
    <MonthlyHeatmap
      trades={trades}
      selectedDate={null}
      onDayClick={(date) => {
        if (date) router.push(`/journal?date=${date}`);
      }}
    />
  );
}
