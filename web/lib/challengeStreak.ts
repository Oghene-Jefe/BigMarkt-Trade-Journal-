import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyChallengeBadge } from "@/lib/actions/notificationTriggers";

const BADGE_THRESHOLDS: Array<{ days: number; type: string; name: string }> = [
  { days: 7,  type: "streak_7",  name: "Week Warrior" },
  { days: 14, type: "streak_14", name: "Fortnight Trader" },
  { days: 30, type: "streak_30", name: "Monthly Master" },
  { days: 60, type: "streak_60", name: "Consistent Pro" },
];

function dayDiff(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

// Update the user's active-challenge streak after a successful trade insert.
// Always non-fatal — caller wraps in try/catch and ignores errors.
export async function updateChallengeStreak(
  sb: SupabaseClient,
  userId: string,
  tradeDate: string,
): Promise<void> {
  const { data: challenge } = await sb
    .from("challenges")
    .select("id, current_streak, longest_streak, last_trade_date")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) return;

  const last = challenge.last_trade_date as string | null;
  const currentStreak = Number(challenge.current_streak ?? 0);
  const longestStreak = Number(challenge.longest_streak ?? 0);

  let nextStreak = currentStreak;
  let brokenAt: string | null = null;

  if (!last) {
    nextStreak = 1;
  } else {
    const diff = dayDiff(last, tradeDate);
    if (diff === 0) return; // already counted today
    if (diff === 1) {
      nextStreak = currentStreak + 1;
    } else if (diff > 1) {
      nextStreak = 1;
      brokenAt = new Date().toISOString();
    } else {
      // tradeDate is before last_trade_date — ignore (likely a backfill)
      return;
    }
  }

  const nextLongest = Math.max(longestStreak, nextStreak);

  const update: Record<string, unknown> = {
    current_streak: nextStreak,
    longest_streak: nextLongest,
    last_trade_date: tradeDate,
  };
  if (brokenAt) update.streak_broken_at = brokenAt;

  await sb.from("challenges").update(update).eq("id", challenge.id);

  // Award any newly-crossed badge thresholds.
  for (const t of BADGE_THRESHOLDS) {
    if (nextStreak >= t.days && currentStreak < t.days) {
      const { data: existing } = await sb
        .from("badges")
        .select("id")
        .eq("user_id", userId)
        .eq("badge_type", t.type)
        .maybeSingle();
      if (existing) continue;

      const { error: insertErr } = await sb.from("badges").insert({
        user_id: userId,
        badge_type: t.type,
        badge_name: t.name,
        metadata: { streak_days: t.days, challenge_id: challenge.id },
      });
      if (!insertErr) {
        await notifyChallengeBadge(sb, userId, t.name);
      }
    }
  }
}
