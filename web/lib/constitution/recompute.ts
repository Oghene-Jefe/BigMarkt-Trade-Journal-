// Trading Constitution recompute — the ONLY part of the engine that touches the
// DB. Loads the user's active constitution, gathers the same-day trade context
// and risk baseline, runs the pure engine, and rewrites this trade's violation
// rows (delete-before-insert dedupe).
//
// Callers (manual trade actions, EA ingest) MUST wrap this in try/catch — it is
// best-effort and must never break the trade-save or ingest path.

import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateTrade, type Constitution, type ConstitutionTrade } from "./engine";

// The trade fields recompute needs. Callers pass a freshly-read trade row.
export type RecomputeTrade = ConstitutionTrade & {
  id: string;
  user_id: string;
  broker_account_id: string | null;
};

const SAME_DAY_FIELDS =
  "pair, entry_price, stop_loss, take_profit, lot_size, balance_at_open, open_time, close_time, pnl, status";

// y-m-d of an instant in a given IANA timezone (e.g. "2026-06-20").
function localDate(iso: string | null, tz: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(t));
  } catch {
    // Bad tz string → fall back to UTC date.
    return new Date(t).toISOString().slice(0, 10);
  }
}

export async function recomputeViolationsForTrade(
  supabase: SupabaseClient,
  trade: RecomputeTrade,
): Promise<void> {
  // 1. Active constitution (one per user). None / inactive → nothing to do.
  const { data: con, error: conErr } = await supabase
    .from("trading_constitutions")
    .select(
      "is_active, max_risk_pct, require_stop_loss, max_trades_per_day, allowed_instruments, min_rr, max_daily_loss_pct, risk_mode, risk_baseline",
    )
    .eq("user_id", trade.user_id)
    .maybeSingle();
  // A real fetch error must not be silently treated as "no constitution" — throw
  // so the caller's try/catch fires instead of leaving the trade falsely clean.
  if (conErr) throw conErr;

  if (!con || con.is_active !== true) return;
  const constitution = con as Constitution;

  // 2. Same-day trade context (timezone from the user's profile).
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", trade.user_id)
    .maybeSingle();
  if (profErr) throw profErr;
  const tz = (prof?.timezone as string | null) || "UTC";
  const tradeDay = localDate(trade.open_time, tz);

  let sameDayTrades: ConstitutionTrade[] = [];
  const anchorMs = trade.open_time ? Date.parse(trade.open_time) : NaN;
  if (tradeDay && Number.isFinite(anchorMs)) {
    // Bounded fetch: ±36h around this trade's open covers the prior-day opens
    // and same-day closes we need, then filter to the exact local day in JS.
    const windowStart = new Date(anchorMs - 36 * 3600 * 1000).toISOString();
    const windowEnd = new Date(anchorMs + 36 * 3600 * 1000).toISOString();
    const { data: rows } = await supabase
      .from("trades")
      .select(SAME_DAY_FIELDS)
      .eq("user_id", trade.user_id)
      .gte("open_time", windowStart)
      .lte("open_time", windowEnd)
      .limit(500);
    sameDayTrades = ((rows ?? []) as ConstitutionTrade[]).filter(
      (r) =>
        localDate(r.open_time, tz) === tradeDay ||
        localDate(r.close_time, tz) === tradeDay,
    );
  }

  // 3. Base balance per risk_mode.
  let baseBalance: number | null = null;
  if (constitution.risk_mode === "static") {
    baseBalance = constitution.risk_baseline ?? null;
    if (baseBalance == null && trade.broker_account_id) {
      const { data: acct } = await supabase
        .from("broker_accounts")
        .select("starting_balance")
        .eq("id", trade.broker_account_id)
        .maybeSingle();
      baseBalance = (acct?.starting_balance as number | null) ?? null;
    }
  } else {
    // trailing: balance snapshot at the time this trade opened.
    baseBalance = trade.balance_at_open ?? null;
  }

  // 4. Evaluate (pure).
  const violations = evaluateTrade({ trade, constitution, sameDayTrades, baseBalance });

  // 5. Clean delete-before-insert dedupe. Callers pass the SERVICE-ROLE client
  //    (bypasses RLS), so the DELETE always clears this trade's rows — including
  //    a rule that stopped failing on an edited trade — before the fresh INSERT.
  //    Scoped strictly to this trade.
  const { error: delErr } = await supabase
    .from("constitution_violations")
    .delete()
    .eq("trade_id", trade.id);
  // A failed DELETE would leave stale violation rows — throw so the caller's
  // try/catch fires rather than silently corrupting adherence.
  if (delErr) throw delErr;

  if (violations.length > 0) {
    const rows = violations.map((v) => ({
      user_id: trade.user_id,
      trade_id: trade.id,
      rule_key: v.rule_key,
      actual: v.actual,
      allowed: v.allowed,
      detail: v.detail,
    }));
    const { error: insErr } = await supabase.from("constitution_violations").insert(rows);
    if (insErr) throw insErr;
  }
}
