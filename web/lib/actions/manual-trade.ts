"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { safeDbError } from "@/lib/db-error";

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

  const { error } = await sb.from("trades").insert(row);

  if (error) {
    return { error: safeDbError(error, "Failed to save trade.", "manual_trade_insert") };
  }

  return { success: true };
}
