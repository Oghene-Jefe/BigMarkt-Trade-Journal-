// Trading Constitution deviation engine — PURE.
//
// evaluateTrade() takes a trade, the user's constitution, the user's trades on
// the same calendar day (already day-filtered in the user's timezone by the
// caller), and a precomputed baseBalance, and returns the rules the trade
// broke. It performs NO database calls and reads no clock — everything it needs
// is passed in, so it's deterministic and unit-testable.
//
// A rule is only evaluated when its field is set (non-null). A skipped rule is
// NEITHER pass nor fail — it simply produces no row. Every division is guarded.

import { computeRiskMoney, normalizeSymbol } from "@/lib/pip-values";

export type ConstitutionTrade = {
  pair: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  lot_size: number | null;
  balance_at_open: number | null;
  open_time: string | null;
  close_time: string | null;
  pnl: number | null;
  status: string | null;
};

export type Constitution = {
  is_active: boolean;
  max_risk_pct: number | null;
  require_stop_loss: boolean | null;
  max_trades_per_day: number | null;
  allowed_instruments: string[] | null;
  min_rr: number | null;
  max_daily_loss_pct: number | null;
  risk_mode: "trailing" | "static";
  risk_baseline: number | null;
};

export type Violation = {
  rule_key: string;
  actual: number | null;
  allowed: number | null;
  detail: string | null;
};

function hasValue(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n !== 0;
}

function ms(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function evaluateTrade(args: {
  trade: ConstitutionTrade;
  constitution: Constitution;
  // The user's trades on the SAME calendar day (caller filters by timezone).
  sameDayTrades: ConstitutionTrade[];
  // Risk baseline in account currency, precomputed by the caller per risk_mode.
  // null when unavailable (e.g. trailing mode but balance_at_open is missing).
  baseBalance: number | null;
}): Violation[] {
  const { trade, constitution: c, sameDayTrades, baseBalance } = args;
  const out: Violation[] = [];

  const hasStop = hasValue(trade.stop_loss);

  // ── require_stop_loss ──────────────────────────────────────────────────────
  if (c.require_stop_loss === true && !hasStop) {
    out.push({
      rule_key: "require_stop_loss",
      actual: null,
      allowed: null,
      detail: "No stop loss set on this trade",
    });
  }

  // ── max_risk_pct ───────────────────────────────────────────────────────────
  // Needs a stop loss AND a base balance. Missing either → SKIP (the SL gap is
  // already covered by require_stop_loss; we don't double-flag).
  if (c.max_risk_pct != null && hasStop && baseBalance != null && baseBalance !== 0) {
    const { riskMoney, approximate } = computeRiskMoney({
      entry: trade.entry_price,
      stopLoss: trade.stop_loss,
      lot: trade.lot_size,
      pair: trade.pair,
    });
    if (riskMoney != null) {
      const riskPct = (riskMoney / baseBalance) * 100;
      if (riskPct > c.max_risk_pct) {
        out.push({
          rule_key: "max_risk_pct",
          actual: round2(riskPct),
          allowed: c.max_risk_pct,
          detail: approximate ? "approximate (pip value estimated)" : null,
        });
      }
    }
  }

  // ── min_rr (PLANNED R:R from TP/SL, not achieved) ──────────────────────────
  if (c.min_rr != null && hasStop && hasValue(trade.take_profit) && trade.entry_price != null) {
    const risk = Math.abs(trade.entry_price - (trade.stop_loss as number));
    if (risk > 0) {
      const plannedRR = Math.abs((trade.take_profit as number) - trade.entry_price) / risk;
      if (plannedRR < c.min_rr) {
        out.push({
          rule_key: "min_rr",
          actual: round2(plannedRR),
          allowed: c.min_rr,
          detail: "Planned R:R below minimum",
        });
      }
    }
  }

  // ── allowed_instruments ────────────────────────────────────────────────────
  if (c.allowed_instruments && c.allowed_instruments.length > 0) {
    const allowed = new Set(c.allowed_instruments.map(normalizeSymbol));
    const pairKey = trade.pair ? normalizeSymbol(trade.pair) : "";
    if (!allowed.has(pairKey)) {
      out.push({
        rule_key: "allowed_instruments",
        actual: null,
        allowed: null,
        detail: `${trade.pair ?? "Unknown"} is not in your allowed instruments`,
      });
    }
  }

  // ── max_trades_per_day ─────────────────────────────────────────────────────
  // Count same-day trades opened at or before this one. > limit → violation on
  // this trade (the one that crossed the line, and every one after it).
  if (c.max_trades_per_day != null) {
    const thisOpen = ms(trade.open_time);
    let count = 0;
    for (const td of sameDayTrades) {
      const o = ms(td.open_time);
      if (thisOpen == null || o == null || o <= thisOpen) count++;
    }
    if (count > c.max_trades_per_day) {
      out.push({
        rule_key: "max_trades_per_day",
        actual: count,
        allowed: c.max_trades_per_day,
        detail: `Trade #${count} of the day (limit ${c.max_trades_per_day})`,
      });
    }
  }

  // ── max_daily_loss_pct ─────────────────────────────────────────────────────
  // Realized loss BEFORE this trade opened. Opening once the day's realized loss
  // has breached the limit is the violation.
  if (c.max_daily_loss_pct != null && baseBalance != null && baseBalance !== 0) {
    const thisOpen = ms(trade.open_time);
    let realized = 0;
    for (const td of sameDayTrades) {
      const closed = (td.status === "closed" || td.status == null);
      const ct = ms(td.close_time);
      if (closed && ct != null && (thisOpen == null || ct < thisOpen)) {
        realized += td.pnl ?? 0;
      }
    }
    const limitMoney = -(c.max_daily_loss_pct / 100) * baseBalance;
    if (realized <= limitMoney) {
      out.push({
        rule_key: "max_daily_loss_pct",
        actual: round2((realized / baseBalance) * 100),
        allowed: c.max_daily_loss_pct,
        detail: "Opened after exceeding daily loss limit",
      });
    }
  }

  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
