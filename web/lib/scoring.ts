// Dual-tier performance scoring engine. Pure TS, no side effects.

export type ScoringTrade = {
  pnl: number;
  rr_ratio: number | null;
  result: string;
  trust_badge: string;
  created_at: string;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
};

export type ScoreTier = 'none' | 'active' | 'pro';

export type ScoreResult = {
  active_expectancy_score: number;
  active_winrate_score: number;
  active_drawdown_score: number;
  active_regularity_score: number;
  active_score: number;
  active_eligible: boolean;

  pro_expectancy_score: number;
  pro_sortino_score: number;
  pro_drawdown_score: number;
  pro_regularity_score: number;
  pro_score: number;
  pro_eligible: boolean;

  score_tier: ScoreTier;

  trade_count: number;
  win_rate_pct: number;
  avg_rr: number;
  expectancy_pct: number;
  sortino_ratio: number;
  max_drawdown_pct: number;
  max_drawdown_weeks: number;
  weekly_trade_cv: number;
  account_history_days: number;

  gate_min_trades_active: boolean;
  gate_min_days_active: boolean;
  gate_positive_expectancy: boolean;
  gate_automated_mode: boolean;
  gate_live_account: boolean;
  gate_min_trades_pro: boolean;
  gate_min_days_pro: boolean;
  gate_max_drawdown_pro: boolean;
};

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isWin(t: ScoringTrade): boolean {
  return t.result === 'win' || t.pnl > 0;
}
function isLoss(t: ScoringTrade): boolean {
  return t.result === 'loss' || t.pnl < 0;
}
function isBE(t: ScoringTrade): boolean {
  return t.result === 'BE' || t.pnl === 0;
}

export function calcExpectancy(trades: ScoringTrade[]): number {
  const wins = trades.filter(isWin);
  const losses = trades.filter((t) => !isWin(t) && !isBE(t) && isLoss(t));
  if (wins.length < 2 || losses.length < 2) return 0;
  const nonBE = trades.filter((t) => !isBE(t));
  if (nonBE.length === 0) return 0;
  const meanAbs =
    nonBE.reduce((s, t) => s + Math.abs(t.pnl), 0) / nonBE.length;
  if (meanAbs === 0) return 0;
  const avgPnl = nonBE.reduce((s, t) => s + t.pnl, 0) / nonBE.length;
  return (avgPnl / meanAbs) * 100;
}

export function calcExpectancyScore(expectancyPct: number): number {
  // -20% -> 0, 0% -> 50, +20% -> 100, linear
  const score = 50 + (expectancyPct / 20) * 50;
  return clamp(score, 0, 100);
}

export function calcWinRate(trades: ScoringTrade[]): number {
  const verified = trades.filter((t) => t.trust_badge === 'auto_verified');
  const wins = verified.filter(isWin).length;
  const losses = verified.filter((t) => !isWin(t) && !isBE(t) && isLoss(t))
    .length;
  const denom = wins + losses;
  if (denom === 0) return 0;
  return (wins / denom) * 100;
}

export function calcWinRateScore(winRatePct: number): number {
  return clamp(winRatePct, 0, 100);
}

export function calcMaxDrawdown(
  trades: ScoringTrade[]
): { pct: number; weeks: number } {
  if (trades.length < 5) return { pct: 0, weeks: 0 };
  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let cum = 0;
  let peak = 0;
  let peakIdx = 0;
  let maxDDPct = 0;
  let maxDDWeeks = 0;
  let troughTime = sorted[0] ? new Date(sorted[0].created_at).getTime() : 0;
  let peakTime = troughTime;

  for (let i = 0; i < sorted.length; i++) {
    cum += sorted[i].pnl;
    const t = new Date(sorted[i].created_at).getTime();
    if (cum > peak) {
      peak = cum;
      peakIdx = i;
      peakTime = t;
    }
    const denom = peak === 0 ? Math.max(1, Math.abs(cum)) : Math.abs(peak);
    const ddPct = peak > 0 ? ((peak - cum) / denom) * 100 : 0;
    if (ddPct > maxDDPct) {
      maxDDPct = ddPct;
      troughTime = t;
      const weeks = (troughTime - peakTime) / (1000 * 60 * 60 * 24 * 7);
      maxDDWeeks = Math.max(0, Math.round(weeks));
    }
    void peakIdx;
  }
  return { pct: maxDDPct, weeks: maxDDWeeks };
}

export function calcDrawdownScore(
  ddPct: number,
  ddWeeks: number,
  tier: 'active' | 'pro'
): number {
  if (tier === 'active') {
    return clamp(100 - ddPct * 2, 0, 100);
  }
  const durationMultiplier = Math.min(1 + ddWeeks / 4, 7.5);
  const effective = ddPct * durationMultiplier;
  return clamp(100 - effective * 2, 0, 100);
}

export function calcSortino(trades: ScoringTrade[]): number {
  const verified = trades.filter((t) => t.trust_badge === 'auto_verified');
  const byDay = new Map<string, number>();
  for (const t of verified) {
    const day = new Date(t.created_at).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + t.pnl);
  }
  if (byDay.size < 10) return 0;
  const daily = Array.from(byDay.values());
  const mean = daily.reduce((s, v) => s + v, 0) / daily.length;
  const negatives = daily.filter((v) => v < 0);
  if (negatives.length === 0) return 3.0;
  const downsideVar =
    negatives.reduce((s, v) => s + v * v, 0) / daily.length;
  const downsideDev = Math.sqrt(downsideVar);
  if (downsideDev === 0) return 3.0;
  const raw = mean / downsideDev;
  return clamp(raw, -1, 10);
}

export function calcSortinoScore(sortino: number): number {
  return clamp((sortino / 3.0) * 100, 0, 100);
}

export function calcWeeklyRegularity(
  trades: ScoringTrade[],
  windowDays: number
): number {
  if (trades.length === 0) return 999;
  const now = Math.max(
    ...trades.map((t) => new Date(t.created_at).getTime())
  );
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
  const inWindow = trades.filter(
    (t) => new Date(t.created_at).getTime() >= cutoff
  );
  const byWeek = new Map<string, number>();
  for (const t of inWindow) {
    const d = new Date(t.created_at);
    const year = d.getUTCFullYear();
    const onejan = new Date(Date.UTC(year, 0, 1));
    const week = Math.floor(
      (d.getTime() - onejan.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const key = `${year}-${week}`;
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }
  if (byWeek.size < 2) return 999;
  const counts = Array.from(byWeek.values());
  const mean = counts.reduce((s, v) => s + v, 0) / counts.length;
  if (mean === 0) return 999;
  const variance =
    counts.reduce((s, v) => s + (v - mean) ** 2, 0) / counts.length;
  const stdev = Math.sqrt(variance);
  return stdev / mean;
}

export function calcRegularityScore(cv: number): number {
  // CV 0 -> 100, CV 1.0 -> 0, linear
  return clamp(100 - cv * 100, 0, 100);
}

export function calcAccountHistoryDays(trades: ScoringTrade[]): number {
  const verified = trades.filter((t) => t.trust_badge === 'auto_verified');
  if (verified.length === 0) return 0;
  const times = verified.map((t) => new Date(t.created_at).getTime());
  const earliest = Math.min(...times);
  const latest = Math.max(...times);
  return Math.floor((latest - earliest) / (1000 * 60 * 60 * 24));
}

function calcAvgRR(trades: ScoringTrade[]): number {
  const rrs = trades
    .map((t) => t.rr_ratio)
    .filter((v): v is number => typeof v === 'number' && isFinite(v));
  if (rrs.length === 0) return 0;
  return rrs.reduce((s, v) => s + v, 0) / rrs.length;
}

export function calculateScore(
  allTrades: ScoringTrade[],
  isAutomated: boolean,
  isLive: boolean
): ScoreResult {
  const trades = allTrades.filter((t) => t.trust_badge === 'auto_verified');

  const trade_count = trades.length;
  const account_history_days = calcAccountHistoryDays(trades);
  const expectancy_pct = calcExpectancy(trades);
  const win_rate_pct = calcWinRate(trades);
  const avg_rr = calcAvgRR(trades);
  const dd = calcMaxDrawdown(trades);
  const max_drawdown_pct = dd.pct;
  const max_drawdown_weeks = dd.weeks;
  const sortino_ratio = calcSortino(trades);
  const weekly_trade_cv = calcWeeklyRegularity(trades, 90);

  const gate_min_trades_active = trade_count >= 30;
  const gate_min_days_active = account_history_days >= 30;
  const gate_positive_expectancy = expectancy_pct > 0;
  const gate_automated_mode = isAutomated;
  const gate_live_account = isLive;
  const gate_min_trades_pro = trade_count >= 50;
  const gate_min_days_pro = account_history_days >= 60;
  const gate_max_drawdown_pro = max_drawdown_pct <= 30;

  const active_eligible =
    gate_min_trades_active &&
    gate_min_days_active &&
    gate_positive_expectancy &&
    gate_automated_mode &&
    gate_live_account;

  const pro_eligible =
    active_eligible &&
    gate_min_trades_pro &&
    gate_min_days_pro &&
    gate_max_drawdown_pro;

  let active_expectancy_score = 0;
  let active_winrate_score = 0;
  let active_drawdown_score = 0;
  let active_regularity_score = 0;
  let active_score = 0;

  if (active_eligible) {
    active_expectancy_score = calcExpectancyScore(expectancy_pct);
    active_winrate_score = calcWinRateScore(win_rate_pct);
    active_drawdown_score = calcDrawdownScore(
      max_drawdown_pct,
      max_drawdown_weeks,
      'active'
    );
    active_regularity_score = calcRegularityScore(weekly_trade_cv);
    active_score =
      active_expectancy_score * 0.4 +
      active_winrate_score * 0.25 +
      active_drawdown_score * 0.2 +
      active_regularity_score * 0.15;
  }

  let pro_expectancy_score = 0;
  let pro_sortino_score = 0;
  let pro_drawdown_score = 0;
  let pro_regularity_score = 0;
  let pro_score = 0;

  if (pro_eligible) {
    pro_expectancy_score = calcExpectancyScore(expectancy_pct);
    pro_sortino_score = calcSortinoScore(sortino_ratio);
    pro_drawdown_score = calcDrawdownScore(
      max_drawdown_pct,
      max_drawdown_weeks,
      'pro'
    );
    pro_regularity_score = calcRegularityScore(weekly_trade_cv);
    pro_score =
      pro_expectancy_score * 0.35 +
      pro_sortino_score * 0.3 +
      pro_drawdown_score * 0.2 +
      pro_regularity_score * 0.15;
  }

  let score_tier: ScoreTier = 'none';
  if (pro_eligible && pro_score >= 70) score_tier = 'pro';
  else if (active_eligible && active_score >= 60) score_tier = 'active';

  return {
    active_expectancy_score: round2(active_expectancy_score),
    active_winrate_score: round2(active_winrate_score),
    active_drawdown_score: round2(active_drawdown_score),
    active_regularity_score: round2(active_regularity_score),
    active_score: round2(active_score),
    active_eligible,

    pro_expectancy_score: round2(pro_expectancy_score),
    pro_sortino_score: round2(pro_sortino_score),
    pro_drawdown_score: round2(pro_drawdown_score),
    pro_regularity_score: round2(pro_regularity_score),
    pro_score: round2(pro_score),
    pro_eligible,

    score_tier,

    trade_count,
    win_rate_pct: round2(win_rate_pct),
    avg_rr: round2(avg_rr),
    expectancy_pct: round2(expectancy_pct),
    sortino_ratio: round2(sortino_ratio),
    max_drawdown_pct: round2(max_drawdown_pct),
    max_drawdown_weeks,
    weekly_trade_cv: round2(weekly_trade_cv),
    account_history_days,

    gate_min_trades_active,
    gate_min_days_active,
    gate_positive_expectancy,
    gate_automated_mode,
    gate_live_account,
    gate_min_trades_pro,
    gate_min_days_pro,
    gate_max_drawdown_pro,
  };
}
