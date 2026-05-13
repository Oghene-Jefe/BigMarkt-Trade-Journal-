import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateScore, type ScoringTrade } from "@/lib/scoring";

// Shared score-recalc core. Accepts any Supabase client (session-scoped from
// a server action, or service-role from the EA ingest route). The caller is
// responsible for authorization — this helper trusts the userId it's given
// and uses it to scope both reads and the upsert.
export async function recalculateAccountScoreWithClient(
  sb: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<{ success: true } | { error: string }> {
  const { data: account, error: accountErr } = await sb
    .from("broker_accounts")
    .select("id, journal_mode, account_type")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (accountErr || !account) {
    return { error: "Account not found" };
  }

  const { data: tradeRows, error: tradesErr } = await sb
    .from("trades")
    .select(
      "pnl, rr_ratio, result, trust_badge, created_at, entry_price, exit_price, stop_loss",
    )
    .eq("broker_account_id", accountId)
    .eq("user_id", userId)
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
        user_id: userId,
        ...result,
        last_scored_at: new Date().toISOString(),
      },
      { onConflict: "broker_account_id" },
    );

  if (upsertErr) {
    return { error: upsertErr.message };
  }

  return { success: true };
}
