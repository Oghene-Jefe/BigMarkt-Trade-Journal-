"use client";

import { useMemo, useState } from "react";
import type { TradeRow } from "@/lib/types";
import {
  groupTradesByDay,
  getDayColor,
  getMonthDays,
  getMonthPulse,
} from "@/lib/heatmap";

interface MonthlyHeatmapProps {
  trades: TradeRow[];
  onDayClick: (date: string | null) => void;
  selectedDate: string | null;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function MonthlyHeatmap({
  trades,
  onDayClick,
  selectedDate,
}: MonthlyHeatmapProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [displayYear, setDisplayYear] = useState(currentYear);
  const [displayMonth, setDisplayMonth] = useState(currentMonth);

  const isAtCurrentMonth =
    displayYear === currentYear && displayMonth === currentMonth;
  const today = todayKey();

  const days = useMemo(
    () => getMonthDays(displayYear, displayMonth),
    [displayYear, displayMonth],
  );
  const byDay = useMemo(() => groupTradesByDay(trades), [trades]);
  const pulse = useMemo(
    () => getMonthPulse(trades, displayYear, displayMonth),
    [trades, displayYear, displayMonth],
  );

  function goPrev() {
    if (displayMonth === 0) {
      setDisplayYear(displayYear - 1);
      setDisplayMonth(11);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  }

  function goNext() {
    if (isAtCurrentMonth) return;
    if (displayMonth === 11) {
      setDisplayYear(displayYear + 1);
      setDisplayMonth(0);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  }

  const hasMonthTrades =
    pulse.winDays > 0 ||
    pulse.lossDays > 0 ||
    pulse.bestDay !== 0 ||
    pulse.worstDay !== 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous month"
          className="rounded-md border border-white/10 bg-panel px-3 py-1 text-gold hover:bg-white/5"
        >
          ‹
        </button>
        <div className="font-display text-lg font-bold tracking-widest text-gold">
          {MONTH_NAMES[displayMonth]} {displayYear}
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={isAtCurrentMonth}
          aria-label="Next month"
          className={`rounded-md border border-white/10 bg-panel px-3 py-1 ${
            isAtCurrentMonth
              ? "cursor-not-allowed text-muted opacity-40"
              : "text-gold hover:bg-white/5"
          }`}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted">
        {DOW.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, idx) => {
          if (!d.isCurrentMonth) {
            // Off-month placeholder. bg-white/5 is already mapped in
            // globals.css under :root.light (dark tint on white) and is a
            // subtle light tint in dark mode — readable in both. Previous
            // hardcoded #0a0a0a was unreadable on the white light panel.
            return (
              <div
                key={`${d.date}-${idx}`}
                className="h-10 w-full rounded-sm bg-white/5"
              />
            );
          }
          const stats = byDay[d.date];
          const hasTrades = !!stats && stats.total > 0;
          const allBE =
            !!stats &&
            stats.total > 0 &&
            stats.wins === 0 &&
            stats.losses === 0 &&
            stats.breakeven > 0;
          const bg = getDayColor(stats?.pnl ?? 0, hasTrades, allBE);
          const isSelected = selectedDate === d.date;
          const isToday = d.date === today;
          const dayNum = Number(d.date.split("-")[2]);
          // "No trades" cells fall back to a theme-adaptive Tailwind tint;
          // every other state (profit/loss/breakeven) uses the vivid hex
          // from getDayColor and reads correctly in both themes.
          const isNoTrades = !hasTrades;
          return (
            <button
              key={`${d.date}-${idx}`}
              type="button"
              onClick={() => onDayClick(isSelected ? null : d.date)}
              className={`relative h-10 w-full cursor-pointer rounded-sm text-left transition ${
                isSelected ? "ring-2 ring-[#D4AF37]" : ""
              } ${isNoTrades ? "bg-white/10" : ""}`}
              style={isNoTrades ? undefined : { backgroundColor: bg }}
              title={
                hasTrades
                  ? `${d.date} · ${stats!.total} trade${stats!.total === 1 ? "" : "s"} · ${stats!.pnl >= 0 ? "+" : ""}${stats!.pnl.toFixed(2)}`
                  : d.date
              }
            >
              {/* Inline color on the day number so it stays readable
                  regardless of theme: on vivid trade tiles a near-white
                  reads on both modes; on the empty/off-month tints we
                  switch to the themed muted token. */}
              <span
                className="absolute left-1 top-0.5 text-[10px] font-medium"
                style={{
                  color: isToday
                    ? "#D4AF37"
                    : isNoTrades
                      ? "rgb(var(--color-muted))"
                      : "rgba(255,255,255,0.85)",
                }}
              >
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <LegendSwatch color="#22c55e" label="Profit" />
        <LegendSwatch color="#ef4444" label="Loss" />
        <LegendSwatch color="#D4AF37" label="Breakeven" />
        <LegendSwatch swatchClass="bg-white/10" label="No trades" />
      </div>

      <div className="text-center text-xs text-gold/70">
        {hasMonthTrades ? (
          <>
            {pulse.winDays} win day{pulse.winDays === 1 ? "" : "s"} ·{" "}
            {pulse.lossDays} loss day{pulse.lossDays === 1 ? "" : "s"} · best +$
            {pulse.bestDay.toFixed(0)} · worst -$
            {Math.abs(pulse.worstDay).toFixed(0)}
          </>
        ) : (
          "No trades recorded this month"
        )}
      </div>
    </div>
  );
}

function LegendSwatch({
  color,
  swatchClass,
  label,
}: {
  color?: string;
  swatchClass?: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-3 w-3 rounded-sm ${swatchClass ?? ""}`}
        style={color ? { backgroundColor: color } : undefined}
      />
      {label}
    </span>
  );
}
