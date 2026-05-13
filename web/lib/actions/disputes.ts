"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { createNotification } from "@/lib/actions/create-notification";
import type { Dispute, DisputeReason } from "@/lib/types";

export async function raiseDisputeAction(
  leaderId: string,
  reason: DisputeReason,
  description: string,
  evidenceUrl?: string
) {
  const user = await requireUser();

  if (leaderId === user.id) {
    return { error: "You cannot raise a dispute against yourself" };
  }

  const sb = await supabaseServer();

  const { data: existing, error: existingErr } = await sb
    .from("disputes")
    .select("id")
    .eq("raised_by", user.id)
    .eq("leader_id", leaderId)
    .in("status", ["open", "under_review"])
    .limit(1);

  if (existingErr) return { error: existingErr.message };
  if ((existing ?? []).length > 0) {
    return { error: "You already have an open dispute against this leader" };
  }

  const { error: insertErr } = await sb.from("disputes").insert({
    raised_by: user.id,
    leader_id: leaderId,
    reason,
    description,
    evidence_url: evidenceUrl ?? null,
    status: "open",
  });

  if (insertErr) return { error: insertErr.message };

  await createNotification(
    sb,
    leaderId,
    "dispute_opened",
    "Dispute filed against you",
    "A dispute has been raised against your account. Our team will review it.",
  );

  return { success: true as const };
}

export async function getMyDisputesAction(): Promise<Dispute[] | { error: string }> {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("disputes")
    .select("*")
    .eq("raised_by", user.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return (data ?? []) as Dispute[];
}
