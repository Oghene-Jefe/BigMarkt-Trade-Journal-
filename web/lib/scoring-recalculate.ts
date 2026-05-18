import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateScore, type ScoringTrade, type ScoreTier } from "@/lib/scoring";
import { createNotification } from "@/lib/actions/create-notification";
import { safeDbError } from "@/lib/db-error";

function tierChangeNotification(
  oldTier: ScoreTier,
  newTier: ScoreTier,
): { title: string; body: string } | null {
  if (oldTier === newTier) return null;
  if (oldTier === "none" && newTier === "active") {
    return {
      title: "You reached Active tier on the leaderboard",
      body: "Your verified score has crossed the Active threshold.",
    };
  }
  if (oldTier === "active" && newTier === "pro") {
    return {
      title: "You reached PRO tier — congratulations",
      body: "Your verified score has crossed the PRO threshold.",
    };
  }
  if (oldTier === "pro" && newTier === "active") {
    return {
      title: "Your score tier has dropped to Active",
      body: "Your verified score no longer meets the PRO threshold.",
    };
  }
  if (oldTier !== "none" && newTier === "none") {
    return {
      title: "Your verified score has dropped — check your recent performance",
      body: "Your account no longer meets leaderboard eligibility.",
    };
  }
  return null;
}

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

  // Scoring boundary: only trades after the user's most recent balance reset
  // count. Resets are how a trader signals "start a fresh score" — pre-reset
  // history is intentionally excluded from the leaderboard score, even though
  // it remains visible everywhere else (journal, analytics).
  const { data: lastReset } = await sb
    .from("balance_resets")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const resetBoundary = lastReset?.created_at as string | undefined;

  let tradesQuery = sb
    .from("trades")
    .select(
      "pnl, rr_ratio, result, trust_badge, created_at, entry_price, exit_price, stop_loss",
    )
    .eq("broker_account_id", accountId)
    .eq("user_id", userId);
  if (resetBoundary) {
    tradesQuery = tradesQuery.gt("created_at", resetBoundary);
  }
  const { data: tradeRows, error: tradesErr } = await tradesQuery.order("created_at", {
    ascending: true,
  });

  if (tradesErr) {
    return { error: safeDbError(tradesErr, "Couldn't load trades for scoring.", "score_recalc_trades") };
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

  const { data: prior } = await sb
    .from("account_scores")
    .select("score_tier")
    .eq("broker_account_id", accountId)
    .maybeSingle();
  const oldTier: ScoreTier = (prior?.score_tier as ScoreTier | undefined) ?? "none";

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
    return { error: safeDbError(upsertErr, "Couldn't save score.", "score_recalc_upsert") };
  }

  const change = tierChangeNotification(oldTier, result.score_tier);
  if (change) {
    await createNotification(sb, userId, "score_updated", change.title, change.body);
  }

  return { success: true };
}
