import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/actions/create-notification";

// Thin wrappers around createNotification for specific platform events.
// All are fire-and-forget — they log on failure and never throw.
// The notifications table has no `link` column, so URLs are baked into the body.

export async function notifyScoreUpdate(
  sb: SupabaseClient,
  userId: string,
  newScore: number,
  rank: number,
): Promise<void> {
  await createNotification(
    sb,
    userId,
    "score_updated",
    "Score Updated",
    `Your score is now ${newScore}. You are ranked #${rank}.`,
  );
}

export async function notifyDisputeUpdate(
  sb: SupabaseClient,
  userId: string,
  status: string,
): Promise<void> {
  await createNotification(
    sb,
    userId,
    "dispute_resolved",
    "Dispute Update",
    `Your dispute has been ${status}.`,
  );
}

export async function notifyTradeApproved(
  sb: SupabaseClient,
  userId: string,
  pair: string,
): Promise<void> {
  await createNotification(
    sb,
    userId,
    "trade_approved",
    "Trade Approved",
    `Your ${pair} trade has been verified and approved.`,
  );
}

export async function notifyChallengeBadge(
  sb: SupabaseClient,
  userId: string,
  badgeName: string,
): Promise<void> {
  await createNotification(
    sb,
    userId,
    "challenge_badge",
    "Badge Earned",
    `You earned the ${badgeName} badge. Keep it up!`,
  );
}
