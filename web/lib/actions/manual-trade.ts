"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeDbError } from "@/lib/db-error";
import { recomputeViolationsForTrade, type RecomputeTrade } from "@/lib/constitution/recompute";

// Columns the constitution engine reads. Fetched after a manual write so the
// recompute hook sees the persisted row.
const CONSTITUTION_TRADE_FIELDS =
  "id, user_id, broker_account_id, pair, entry_price, stop_loss, take_profit, lot_size, balance_at_open, open_time, close_time, pnl, status";

async function requireUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return { sb, user };
}

export type ManualTradeInput = {
  brokerAccountId: string;
  symbol: string;
  type: "Buy" | "Sell";
  lots: number;
  openPrice: number;
  closePrice: number;
  openTime: string;
  closeTime: string;
  sl?: number | null;
  tp?: number | null;
  profit: number;
  notes?: string | null;
  tags?: string | null;
};

export type ManualTradeResult = { success: true } | { error: string };

export async function addManualTradeAction(
  input: ManualTradeInput
): Promise<ManualTradeResult> {
  const { sb, user } = await requireUser();

  const direction = input.type === "Buy" ? "BUY" : "SELL";

  // Derive result from profit
  const result =
    input.profit > 0 ? "WIN" : input.profit < 0 ? "LOSS" : "BE";

  // Compute R:R if sl provided
  let rr_ratio: number | null = null;
  if (input.sl != null && input.sl !== input.openPrice) {
    const risk = Math.abs(input.openPrice - input.sl);
    const reward = Math.abs(input.closePrice - input.openPrice);
    rr_ratio = reward > 0 && risk > 0 ? parseFloat((reward / risk).toFixed(2)) : null;
  }

  const row = {
    user_id: user.id,
    broker_account_id: input.brokerAccountId,
    pair: input.symbol.toUpperCase(),
    direction,
    lot_size: input.lots,
    entry_price: input.openPrice,
    exit_price: input.closePrice,
    open_time: input.openTime,
    close_time: input.closeTime,
    stop_loss: input.sl ?? null,
    take_profit: input.tp ?? null,
    pnl: input.profit,
    result,
    rr_ratio,
    notes: input.notes ?? null,
    tags: input.tags ?? null,
    source: "manual",
    verified: false,
    status: "closed",
    capture_source: "manual",
    trust_badge: "manual",
    visibility: "private",
    core_fields_locked: false,
    auto_approved: false,
  };

  const { data: inserted, error } = await sb.from("trades").insert(row).select("id").single();

  if (error || !inserted) {
    return { error: safeDbError(error, "Failed to save trade.", "manual_trade_insert") };
  }

  // Best-effort: recompute this trade's constitution violations. Wrapped so a
  // failure here can NEVER break the trade-save path. The row is read under the
  // user session (RLS confirms ownership), but the violations DELETE+INSERT run
  // through the SERVICE-ROLE client (no user DELETE policy on
  // constitution_violations by design).
  try {
    const { data: persisted } = await sb
      .from("trades")
      .select(CONSTITUTION_TRADE_FIELDS)
      .eq("id", inserted.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (persisted) await recomputeViolationsForTrade(supabaseAdmin(), persisted as RecomputeTrade);
  } catch (err) {
    console.error("constitution recompute (manual) failed — swallowed", err);
  }

  return { success: true };
}
