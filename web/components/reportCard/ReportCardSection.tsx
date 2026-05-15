"use client";

import { useRef, useState } from "react";
import type { TradeRow } from "@/lib/types";
import WeeklyReportCard from "./WeeklyReportCard";
import MonthlyReportCard from "./MonthlyReportCard";
import ReportCardActions from "./ReportCardActions";

interface ReportCardSectionProps {
  trades: TradeRow[];
  username: string;
}

type Tab = "week" | "month";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ReportCardSection({ trades, username }: ReportCardSectionProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [tab, setTab] = useState<Tab>("week");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  const weeklyRef = useRef<HTMLDivElement>(null);
  const monthlyRef = useRef<HTMLDivElement>(null);

  const isAtCurrentMonth = year === currentYear && month === currentMonth;

  function goPrev() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }
  function goNext() {
    if (isAtCurrentMonth) return;
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  const monthSlug = `${MONTH_NAMES[month]!.toLowerCase()}-${year}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-6 border-b border-white/10">
        <TabButton active={tab === "week"} onClick={() => setTab("week")}>
          This Week
        </TabButton>
        <TabButton active={tab === "month"} onClick={() => setTab("month")}>
          This Month
        </TabButton>
      </div>

      {tab === "month" ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-md border border-white/10 bg-panel px-3 py-1 text-gold hover:bg-white/5"
          >
            ‹ Prev
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-gold">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={isAtCurrentMonth}
            className={`rounded-md border border-white/10 bg-panel px-3 py-1 ${
              isAtCurrentMonth
                ? "cursor-not-allowed text-muted opacity-40"
                : "text-gold hover:bg-white/5"
            }`}
          >
            Next ›
          </button>
        </div>
      ) : null}

      <div className="flex justify-center">
        {tab === "week" ? (
          <WeeklyReportCard ref={weeklyRef} trades={trades} username={username} />
        ) : (
          <MonthlyReportCard
            ref={monthlyRef}
            trades={trades}
            username={username}
            year={year}
            month={month}
          />
        )}
      </div>

      {tab === "week" ? (
        <ReportCardActions cardRef={weeklyRef} filename="bigmarkt-weekly-report" />
      ) : (
        <ReportCardActions cardRef={monthlyRef} filename={`bigmarkt-${monthSlug}-report`} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition ${
        active
          ? "border-gold text-gold"
          : "border-transparent text-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
