import type { TradeRow } from "@/lib/types";

// All functions here are pure. The page is responsible for filtering out
// visibility === "exclude" trades before passing them in — keeping that
// concern at the boundary, not duplicated in every util.

export type EquityPoint = {
  date: string;
  equity: number;
  tradeNumber: number;
};

export function buildEquityCurve(trades: TradeRow[]): EquityPoint[] {
  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  let running = 0;
  return sorted.map((t, i) => {
    running += t.pnl ?? 0;
    return {
      date: t.created_at,
      equity: running,
      tradeNumber: i + 1,
    };
  });
}

export type DrawdownPoint = {
  date: string;
  drawdown: number;
  tradeNumber: number;
};

export function buildDrawdownSeries(trades: TradeRow[]): DrawdownPoint[] {
  const curve = buildEquityCurve(trades);
  let peak = 0;
  return curve.map((p) => {
    if (p.equity > peak) peak = p.equity;
    const dd = peak > 0 ? ((p.equity - peak) / peak) * 100 : 0;
    return {
      date: p.date,
      drawdown: dd,
      tradeNumber: p.tradeNumber,
    };
  });
}

export type PairStat = {
  pair: string;
  winRate: number;
  total: number;
  wins: number;
};

export function buildWinRateByPair(trades: TradeRow[]): PairStat[] {
  const map = new Map<string, { wins: number; losses: number; total: number }>();
  for (const t of trades) {
    if (!t.pair) continue;
    const b = map.get(t.pair) ?? { wins: 0, losses: 0, total: 0 };
    b.total += 1;
    if (t.result === "WIN") b.wins += 1;
    else if (t.result === "LOSS") b.losses += 1;
    map.set(t.pair, b);
  }
  const out: PairStat[] = [];
  for (const [pair, b] of map) {
    if (b.total < 3) continue;
    const closed = b.wins + b.losses;
    const winRate = closed > 0 ? (b.wins / closed) * 100 : 0;
    out.push({ pair, winRate, total: b.total, wins: b.wins });
  }
  return out.sort((a, b) => b.total - a.total);
}

export type SessionStat = {
  session: string;
  winRate: number;
  avgPnl: number;
  total: number;
};

export function buildSessionPerformance(trades: TradeRow[]): SessionStat[] {
  const map = new Map<
    string,
    { wins: number; losses: number; pnlSum: number; total: number }
  >();
  for (const t of trades) {
    const key = t.session ?? "Unknown";
    const b = map.get(key) ?? { wins: 0, losses: 0, pnlSum: 0, total: 0 };
    b.total += 1;
    b.pnlSum += t.pnl ?? 0;
    if (t.result === "WIN") b.wins += 1;
    else if (t.result === "LOSS") b.losses += 1;
    map.set(key, b);
  }
  const out: SessionStat[] = [];
  for (const [session, b] of map) {
    const closed = b.wins + b.losses;
    const winRate = closed > 0 ? (b.wins / closed) * 100 : 0;
    const avgPnl = b.total > 0 ? b.pnlSum / b.total : 0;
    out.push({ session, winRate, avgPnl, total: b.total });
  }
  return out.sort((a, b) => b.total - a.total);
}

export type GradeStat = {
  grade: string;
  winRate: number;
  avgPnl: number;
  total: number;
};

const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, Ungraded: 3 };

export function buildSetupGradePerformance(trades: TradeRow[]): GradeStat[] {
  const map = new Map<
    string,
    { wins: number; losses: number; pnlSum: number; total: number }
  >();
  for (const t of trades) {
    const key = t.setup_grade ?? "Ungraded";
    const b = map.get(key) ?? { wins: 0, losses: 0, pnlSum: 0, total: 0 };
    b.total += 1;
    b.pnlSum += t.pnl ?? 0;
    if (t.result === "WIN") b.wins += 1;
    else if (t.result === "LOSS") b.losses += 1;
    map.set(key, b);
  }
  const out: GradeStat[] = [];
  for (const [grade, b] of map) {
    const closed = b.wins + b.losses;
    const winRate = closed > 0 ? (b.wins / closed) * 100 : 0;
    const avgPnl = b.total > 0 ? b.pnlSum / b.total : 0;
    out.push({ grade, winRate, avgPnl, total: b.total });
  }
  return out.sort((a, b) => {
    const ai = GRADE_ORDER[a.grade] ?? 99;
    const bi = GRADE_ORDER[b.grade] ?? 99;
    if (ai !== bi) return ai - bi;
    return a.grade.localeCompare(b.grade);
  });
}

export type EmotionStat = {
  emotion: string;
  winRate: number;
  avgPnl: number;
  total: number;
};

export type PsychologyReport = {
  emotionStats: EmotionStat[];
  bestEmotion: string;
  worstEmotion: string;
  recommendations: string[];
};

export function buildPsychologyReport(trades: TradeRow[]): PsychologyReport {
  const map = new Map<
    string,
    { wins: number; losses: number; pnlSum: number; total: number }
  >();
  for (const t of trades) {
    if (!t.emotions) continue;
    const key = t.emotions;
    const b = map.get(key) ?? { wins: 0, losses: 0, pnlSum: 0, total: 0 };
    b.total += 1;
    b.pnlSum += t.pnl ?? 0;
    if (t.result === "WIN") b.wins += 1;
    else if (t.result === "LOSS") b.losses += 1;
    map.set(key, b);
  }
  const emotionStats: EmotionStat[] = [];
  for (const [emotion, b] of map) {
    const closed = b.wins + b.losses;
    const winRate = closed > 0 ? (b.wins / closed) * 100 : 0;
    const avgPnl = b.total > 0 ? b.pnlSum / b.total : 0;
    emotionStats.push({ emotion, winRate, avgPnl, total: b.total });
  }
  emotionStats.sort((a, b) => b.total - a.total);

  const qualified = emotionStats.filter((e) => e.total >= 3);
  let bestEmotion = "";
  let worstEmotion = "";
  if (qualified.length > 0) {
    const sortedByWr = [...qualified].sort((a, b) => b.winRate - a.winRate);
    bestEmotion = sortedByWr[0]!.emotion;
    worstEmotion = sortedByWr[sortedByWr.length - 1]!.emotion;
    if (bestEmotion === worstEmotion) worstEmotion = "";
  }

  const recommendations: string[] = [];
  const findEmotion = (substr: string) =>
    emotionStats.find((e) =>
      e.emotion.toLowerCase().includes(substr.toLowerCase()),
    );
  const fomo = findEmotion("fomo");
  const calm = findEmotion("calm");
  const tilt = findEmotion("tilt");

  if (fomo && calm && fomo.total >= 3 && calm.total >= 3 && fomo.winRate < calm.winRate) {
    recommendations.push(
      "Your FOMO trades underperform. Consider sitting out when you feel rushed.",
    );
  }
  if (tilt && tilt.total >= 1 && tilt.avgPnl < 0) {
    recommendations.push(
      "Trades placed on tilt are losing you money. Implement a cooling-off rule.",
    );
  }

  const sessions = buildSessionPerformance(trades);
  const ny = sessions.find((s) => s.session.toLowerCase().includes("ny") || s.session.toLowerCase().includes("new york"));
  const london = sessions.find((s) => s.session.toLowerCase().includes("london"));
  if (ny && london && ny.total >= 3 && london.total >= 3 && ny.winRate < london.winRate) {
    recommendations.push(
      "Your NY session underperforms London. Consider reducing size in NY.",
    );
  }

  const grades = buildSetupGradePerformance(trades);
  const a = grades.find((g) => g.grade === "A");
  const bc = grades.filter((g) => g.grade === "B" || g.grade === "C");
  if (a && a.total >= 3 && bc.length > 0) {
    const bcAvgWr =
      bc.reduce((s, g) => s + g.winRate * g.total, 0) /
      bc.reduce((s, g) => s + g.total, 0);
    if (a.winRate >= bcAvgWr + 15) {
      recommendations.push(
        "Your A-grade setups are your edge. Focus on quality over quantity.",
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Not enough data to identify clear patterns yet. Keep journaling consistently.",
    );
  }

  return {
    emotionStats,
    bestEmotion,
    worstEmotion,
    recommendations: recommendations.slice(0, 4),
  };
}
