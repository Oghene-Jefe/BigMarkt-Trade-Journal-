import type { TradeRow } from "@/lib/types";

// Daily aggregation of trades. Keys are local-date strings "YYYY-MM-DD"
// (not UTC) — the heatmap reads as "what happened on this calendar day
// in the user's timezone", which is what traders intuit.
export type DayStats = {
  pnl: number;
  wins: number;
  losses: number;
  breakeven: number;
  total: number;
};

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupTradesByDay(
  trades: TradeRow[],
): Record<string, DayStats> {
  const out: Record<string, DayStats> = {};
  for (const t of trades) {
    if (!t.created_at) continue;
    const key = toLocalDateKey(t.created_at);
    const bucket = out[key] ?? {
      pnl: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      total: 0,
    };
    bucket.pnl += t.pnl ?? 0;
    bucket.total += 1;
    if (t.result === "WIN") bucket.wins += 1;
    else if (t.result === "LOSS") bucket.losses += 1;
    else if (t.result === "BE") bucket.breakeven += 1;
    out[key] = bucket;
  }
  return out;
}

// allBE: day had trades and every closed result is BE (no wins, no losses).
// Mixed days (e.g. wins + BE, or any losses) fall through to pnl tiers.
export function getDayColor(
  pnl: number,
  hasTrades: boolean,
  allBE: boolean = false,
): string {
  if (!hasTrades) return "#141414";
  if (allBE) return "#D4AF37";

  if (pnl > 0) {
    if (pnl < 50) return "#166534";
    if (pnl < 200) return "#16a34a";
    return "#22c55e";
  }
  if (pnl < 0) {
    const abs = Math.abs(pnl);
    if (abs < 50) return "#7f1d1d";
    if (abs < 200) return "#dc2626";
    return "#ef4444";
  }
  // pnl === 0 with trades but not all BE — neutral gold marker.
  return "#D4AF37";
}

export type MonthDay = {
  date: string;
  dayOfWeek: number;
  isCurrentMonth: boolean;
};

// month is 0-indexed (Jan = 0, Dec = 11) to match the JS Date API.
// Returns days padded so the grid starts on Sunday and ends on Saturday.
export function getMonthDays(year: number, month: number): MonthDay[] {
  const first = new Date(year, month, 1);
  const firstDow = first.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: MonthDay[] = [];

  // Leading padding from previous month.
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({
      date: formatDate(d),
      dayOfWeek: d.getDay(),
      isCurrentMonth: false,
    });
  }

  // Current month.
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    days.push({
      date: formatDate(d),
      dayOfWeek: d.getDay(),
      isCurrentMonth: true,
    });
  }

  // Trailing padding to complete the final row (multiple of 7).
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1]!;
    const [ly, lm, ld] = last.date.split("-").map(Number);
    const d = new Date(ly!, (lm ?? 1) - 1, (ld ?? 1) + 1);
    days.push({
      date: formatDate(d),
      dayOfWeek: d.getDay(),
      isCurrentMonth: false,
    });
  }

  return days;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// month is 0-indexed. winDays / lossDays count distinct calendar days
// whose net pnl was positive / negative; BE-only days count toward neither.
export function getMonthPulse(
  trades: TradeRow[],
  year: number,
  month: number,
): { winDays: number; lossDays: number; bestDay: number; worstDay: number } {
  const monthTrades = trades.filter((t) => {
    if (!t.created_at) return false;
    const d = new Date(t.created_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const byDay = groupTradesByDay(monthTrades);
  let winDays = 0;
  let lossDays = 0;
  let bestDay = 0;
  let worstDay = 0;

  for (const stats of Object.values(byDay)) {
    if (stats.pnl > 0) winDays += 1;
    else if (stats.pnl < 0) lossDays += 1;
    if (stats.pnl > bestDay) bestDay = stats.pnl;
    if (stats.pnl < worstDay) worstDay = stats.pnl;
  }

  return { winDays, lossDays, bestDay, worstDay };
}
