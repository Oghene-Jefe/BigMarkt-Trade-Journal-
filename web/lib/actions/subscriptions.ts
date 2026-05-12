"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import type { SubscriptionMode, MinSignalGrade, SubscriptionStatus } from "@/lib/types";

export async function followLeaderAction(
  leaderId: string,
  brokerAccountId: string,
  mode: SubscriptionMode
) {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { data: account, error: accountErr } = await sb
    .from("broker_accounts")
    .select("id, user_id, flow_direction")
    .eq("id", brokerAccountId)
    .maybeSingle();

  if (accountErr) return { error: accountErr.message };
  if (!account || account.user_id !== user.id) {
    return { error: "Broker account not found" };
  }

  if (mode === "execution" && account.flow_direction !== "follower") {
    return { error: "Broker account must be in follower mode for execution" };
  }

  const { data: leaderSubs, error: leaderSubsErr } = await sb
    .from("subscriptions")
    .select("id")
    .eq("follower_id", leaderId)
    .eq("status", "active")
    .limit(1);

  if (leaderSubsErr) return { error: leaderSubsErr.message };

  const leaderAlsoFollows = (leaderSubs ?? []).length > 0;

  const { error: insertErr } = await sb.from("subscriptions").insert({
    follower_id: user.id,
    leader_id: leaderId,
    broker_account_id: brokerAccountId,
    mode,
    status: "active",
    min_signal_grade: "any",
    leader_also_follows: leaderAlsoFollows,
  });

  if (insertErr) return { error: insertErr.message };

  return { success: true as const };
}

export async function unfollowLeaderAction(subscriptionId: string) {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { error } = await sb
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", subscriptionId)
    .eq("follower_id", user.id);

  if (error) return { error: error.message };
  return { success: true as const };
}

export async function updateSubscriptionAction(
  subscriptionId: string,
  updates: {
    mode?: SubscriptionMode;
    min_signal_grade?: MinSignalGrade;
    status?: SubscriptionStatus;
  }
) {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { error } = await sb
    .from("subscriptions")
    .update(updates)
    .eq("id", subscriptionId)
    .eq("follower_id", user.id);

  if (error) return { error: error.message };
  return { success: true as const };
}

export async function unfollowFromFormAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await unfollowLeaderAction(id);
}

export async function toggleSubscriptionStatusFormAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "") as SubscriptionStatus;
  if (!id || (next !== "active" && next !== "paused")) return;
  await updateSubscriptionAction(id, { status: next });
}

export type MySubscriptionRow = {
  id: string;
  leader_id: string;
  broker_account_id: string;
  mode: SubscriptionMode;
  status: SubscriptionStatus;
  min_signal_grade: MinSignalGrade;
  leader_also_follows: boolean;
  created_at: string;
  leader_display_name: string | null;
  leader_username: string | null;
  leader_avatar_path: string | null;
};

export async function getMySubscriptionsAction(): Promise<
  MySubscriptionRow[] | { error: string }
> {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("subscriptions")
    .select(
      "id, leader_id, broker_account_id, mode, status, min_signal_grade, leader_also_follows, created_at, leader:profiles!subscriptions_leader_id_fkey(display_name, username, avatar_path)"
    )
    .eq("follower_id", user.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  type Joined = {
    id: string;
    leader_id: string;
    broker_account_id: string;
    mode: SubscriptionMode;
    status: SubscriptionStatus;
    min_signal_grade: MinSignalGrade;
    leader_also_follows: boolean;
    created_at: string;
    leader:
      | { display_name: string | null; username: string | null; avatar_path: string | null }
      | { display_name: string | null; username: string | null; avatar_path: string | null }[]
      | null;
  };

  const rows = (data ?? []) as unknown as Joined[];
  return rows.map((r) => {
    const leader = Array.isArray(r.leader) ? r.leader[0] ?? null : r.leader;
    return {
      id: r.id,
      leader_id: r.leader_id,
      broker_account_id: r.broker_account_id,
      mode: r.mode,
      status: r.status,
      min_signal_grade: r.min_signal_grade,
      leader_also_follows: r.leader_also_follows,
      created_at: r.created_at,
      leader_display_name: leader?.display_name ?? null,
      leader_username: leader?.username ?? null,
      leader_avatar_path: leader?.avatar_path ?? null,
    };
  });
}
