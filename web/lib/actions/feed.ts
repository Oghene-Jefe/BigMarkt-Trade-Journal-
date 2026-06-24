"use server";

import { requireUser } from "@/lib/auth/require-user";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatars } from "@/lib/storage";

export type FeedTrade = {
  trade_id: string;
  user_id: string;
  pair: string | null;
  direction: string | null;
  result: string | null;
  pnl: number | null;
  rr_ratio: number | null;
  trust_badge: string | null;
  source: string | null;
  status: string | null;
  created_at: string;
  leader_display_name: string | null;
  leader_username: string | null;
  leader_avatar_url: string | null;
};

type FeedRow = Omit<FeedTrade, "leader_avatar_url"> & {
  leader_avatar_path: string | null;
};

// Verified trades from the leaders the caller follows. The RPC is
// SECURITY DEFINER and keys off auth.uid() internally, so we still
// requireUser() here to redirect signed-out callers to /login.
export async function getFollowingFeedAction(
  beforeIso?: string,
): Promise<FeedTrade[]> {
  await requireUser();

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("get_following_feed", {
    p_limit: 50,
    p_before: beforeIso ?? null,
  });

  if (error) {
    console.error("get_following_feed failed", error);
    return [];
  }

  const rows = (data ?? []) as FeedRow[];

  // Batch-sign every leader avatar in one round-trip (mirror follow-graph).
  const paths = rows
    .map((r) => r.leader_avatar_path)
    .filter((p): p is string => Boolean(p));
  const signed = await signAvatars(paths);

  return rows.map(({ leader_avatar_path, ...row }) => ({
    ...row,
    leader_avatar_url: leader_avatar_path ? signed[leader_avatar_path] ?? null : null,
  }));
}
