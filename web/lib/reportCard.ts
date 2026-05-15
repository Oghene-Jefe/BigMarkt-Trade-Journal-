import type { TradeRow } from "@/lib/types";
import { getMonthPulse, groupTradesByDay } from "@/lib/heatmap";

function formatShortDate(d: Date): string {
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "short" });
  return `${weekday} ${day} ${month}`;
}

// Anchor on Monday (Forex convention; matches the news-week window
// elsewhere in the app).
function currentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const offsetToMonday = (day + 6) % 7;
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - offsetToMonday,
    0, 0, 0, 0,
  );
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

type CommonStats = {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPnl: number;
  avgRR: number | null;
  bestTrade: { pair: string; pnl: number } | null;
  worstTrade: { pair: string; pnl: number } | null;
  mostTradedPair: string | null;
};

function summarize(trades: TradeRow[]): CommonStats {
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let totalPnl = 0;
  let rrSum = 0;
  let rrCount = 0;
  let bestTrade: { pair: string; pnl: number } | null = null;
  let worstTrade: { pair: string; pnl: number } | null = null;
  const pairCounts = new Map<string, number>();

  for (const t of trades) {
    if (t.result === "WIN") wins += 1;
    else if (t.result === "LOSS") losses += 1;
    else if (t.result === "BE") breakeven += 1;

    const pnl = t.pnl ?? 0;
    totalPnl += pnl;

    if (t.rr_ratio != null) {
      const rr = typeof t.rr_ratio === "number" ? t.rr_ratio : parseFloat(String(t.rr_ratio));
      if (Number.isFinite(rr)) {
        rrSum += rr;
        rrCount += 1;
      }
    }

    if (t.pair && t.pnl != null) {
      if (!bestTrade || pnl > bestTrade.pnl) bestTrade = { pair: t.pair, pnl };
      if (!worstTrade || pnl < worstTrade.pnl) worstTrade = { pair: t.pair, pnl };
    }

    if (t.pair) {
      pairCounts.set(t.pair, (pairCounts.get(t.pair) ?? 0) + 1);
    }
  }

  const closed = wins + losses;
  const winRate = closed > 0 ? (wins / closed) * 100 : 0;
  const avgRR = rrCount > 0 ? rrSum / rrCount : null;

  let mostTradedPair: string | null = null;
  let mostCount = 0;
  for (const [pair, count] of pairCounts) {
    if (count > mostCount) {
      mostTradedPair = pair;
      mostCount = count;
    }
  }

  return {
    totalTrades: trades.length,
    wins,
    losses,
    breakeven,
    winRate,
    totalPnl,
    avgRR,
    bestTrade,
    worstTrade,
    mostTradedPair,
  };
}

export type WeeklyStats = CommonStats & {
  startDate: string;
  endDate: string;
  avgTradesPerDay: number;
};

export function buildWeeklyStats(trades: TradeRow[]): WeeklyStats {
  const { start, end } = currentWeekRange();
  const weekTrades = trades.filter((t) => {
    if (!t.created_at) return false;
    const d = new Date(t.created_at);
    return d >= start && d < end;
  });

  const base = summarize(weekTrades);
  const endLabel = new Date(end.getTime() - 1);

  return {
    ...base,
    startDate: formatShortDate(start),
    endDate: formatShortDate(endLabel),
    avgTradesPerDay: base.totalTrades / 7,
  };
}

export type MonthlyStats = CommonStats & {
  monthLabel: string;
  winDays: number;
  lossDays: number;
  bestDay: number;
  worstDay: number;
  avgTradesPerDay: number;
  consistency: number;
};

export function buildMonthlyStats(
  trades: TradeRow[],
  year: number,
  month: number,
): MonthlyStats {
  const monthTrades = trades.filter((t) => {
    if (!t.created_at) return false;
    const d = new Date(t.created_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const base = summarize(monthTrades);
  const pulse = getMonthPulse(trades, year, month);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = groupTradesByDay(monthTrades);
  const tradingDays = Object.keys(byDay).length;
  const consistency = tradingDays > 0 ? (pulse.winDays / tradingDays) * 100 : 0;

  return {
    ...base,
    monthLabel,
    winDays: pulse.winDays,
    lossDays: pulse.lossDays,
    bestDay: pulse.bestDay,
    worstDay: pulse.worstDay,
    avgTradesPerDay: base.totalTrades / daysInMonth,
    consistency,
  };
}
