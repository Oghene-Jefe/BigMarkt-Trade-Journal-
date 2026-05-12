"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { calculateScore, type ScoringTrade } from "@/lib/scoring";

export async function recalculateAccountScore(accountId: string) {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { data: account, error: accountErr } = await sb
    .from("broker_accounts")
    .select("id, journal_mode, account_type")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountErr || !account) {
    return { error: "Account not found" as const };
  }

  const { data: tradeRows, error: tradesErr } = await sb
    .from("trades")
    .select(
      "pnl, rr_ratio, result, trust_badge, created_at, entry_price, exit_price, stop_loss"
    )
    .eq("broker_account_id", accountId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (tradesErr) {
    return { error: tradesErr.message };
  }

  const trades: ScoringTrade[] = (tradeRows ?? []).map((t) => ({
    pnl: Number(t.pnl ?? 0),
    rr_ratio: t.rr_ratio === null || t.rr_ratio === undefined ? null : Number(t.rr_ratio),
    result: String(t.result ?? ""),
    trust_badge: String(t.trust_badge ?? ""),
    created_at: String(t.created_at),
    entry_price: t.entry_price === null || t.entry_price === undefined ? null : Number(t.entry_price),
    exit_price: t.exit_price === null || t.exit_price === undefined ? null : Number(t.exit_price),
    stop_loss: t.stop_loss === null || t.stop_loss === undefined ? null : Number(t.stop_loss),
  }));

  const isAutomated = account.journal_mode === "automated";
  const isLive = account.account_type === "live";

  const result = calculateScore(trades, isAutomated, isLive);

  const { error: upsertErr } = await sb
    .from("account_scores")
    .upsert(
      {
        broker_account_id: accountId,
        user_id: user.id,
        ...result,
        last_scored_at: new Date().toISOString(),
      },
      { onConflict: "broker_account_id" }
    );

  if (upsertErr) {
    return { error: upsertErr.message };
  }

  return { success: true as const, score: result };
}
