"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdmin, requireAdminForAction } from "@/lib/admin";
import { safeDbError } from "@/lib/db-error";

const idSchema = z.object({ id: z.string().uuid() });

// Removes all of the target user's app data (trades, balance resets,
// challenges, profile). Storage objects (chart screenshots, avatar) are
// also removed here so we don't leave orphans. The auth.users row itself
// is intentionally left intact — see migration 0011 for rationale.
export async function adminPurgeUserDataAction(fd: FormData) {
  // Server-side admin check before doing any work. The RPC re-checks at
  // the database level, but failing fast here saves the storage round-trip.
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();

  const parsed = idSchema.safeParse({ id: fd.get("id") });
  if (!parsed.success) return;
  const { id } = parsed.data;

  const sb = await supabaseServer();

  // Collect storage paths before the rows disappear. Path lookups go
  // through the admin's session client, which has cross-user SELECT
  // on both `trades` (via trades_admin_select, migration 0044) and
  // `profiles` (via profiles_admin_select, migration 0036).
  const [{ data: trades }, { data: profile }] = await Promise.all([
    sb.from("trades").select("chart_path").eq("user_id", id),
    sb.from("profiles").select("avatar_path").eq("id", id).maybeSingle(),
  ]);

  const chartPaths = (trades ?? [])
    .map((t: { chart_path: string | null }) => t.chart_path)
    .filter((p): p is string => !!p);

  // Audit M-13: storage cleanup used to go through the admin's session
  // client (`sb.storage...`). Storage RLS on the avatars + trade-charts
  // buckets is scoped per-uid path prefix, so the admin's call to remove
  // ANOTHER user's objects silently matched zero rows — orphaned chart
  // screenshots and avatars accumulated indefinitely after every purge.
  // This is a GDPR / CCPA "right to be forgotten" gap, plus a storage
  // cost-creep gap.
  //
  // Fix: use the service-role client for THIS specific cross-user
  // cleanup path. Storage RLS doesn't apply to service-role
  // operations, so the remove() call actually removes the objects.
  // Path inputs are bounded to whatever's stored in the user's own
  // chart_path / avatar_path columns — no caller-supplied path
  // injection risk.
  const sbAdmin = supabaseAdmin();
  if (chartPaths.length > 0) {
    const { error } = await sbAdmin.storage.from("trade-charts").remove(chartPaths);
    if (error) console.error("admin_purge_user_data: chart cleanup failed", error);
  }
  if (profile?.avatar_path) {
    const { error } = await sbAdmin.storage.from("avatars").remove([profile.avatar_path]);
    if (error) console.error("admin_purge_user_data: avatar cleanup failed", error);
  }

  // Then purge the DB rows in one shot via the RPC.
  await sb.rpc("admin_purge_user_data", { target_id: id });

  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------
const userIdSchema = z.object({ id: z.string().uuid() });

export async function banUserAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = userIdSchema.safeParse({ id: fd.get("id") });
  if (!parsed.success) return;
  const reason = String(fd.get("reason") ?? "").slice(0, 500) || null;
  const sb = await supabaseServer();
  await sb
    .from("profiles")
    .update({
      is_banned: true,
      banned_reason: reason,
      banned_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  revalidatePath("/admin/users");
}

export async function unbanUserAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = userIdSchema.safeParse({ id: fd.get("id") });
  if (!parsed.success) return;
  const sb = await supabaseServer();
  await sb
    .from("profiles")
    .update({ is_banned: false, banned_reason: null, banned_at: null })
    .eq("id", parsed.data.id);
  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// Trade oversight
// ---------------------------------------------------------------------------
export async function adminDeleteTradeAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = userIdSchema.safeParse({ id: fd.get("id") });
  if (!parsed.success) return;
  const sb = await supabaseServer();
  // Collect chart path before delete so we can clean the storage object.
  const { data: trade } = await sb
    .from("trades")
    .select("chart_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (trade?.chart_path) {
    await sb.storage.from("trade-charts").remove([trade.chart_path]);
  }
  await sb.from("trades").delete().eq("id", parsed.data.id);
  revalidatePath("/admin/trades");
}

// ---------------------------------------------------------------------------
// Leaderboard overrides
// ---------------------------------------------------------------------------
const overrideSchema = z.object({
  user_id: z.string().uuid(),
  score_override: z.coerce.number().nullable().optional(),
  override_reason: z.string().max(500).optional(),
});

export async function setLeaderboardOverrideAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = overrideSchema.safeParse({
    user_id: fd.get("user_id"),
    score_override: fd.get("score_override") || null,
    override_reason: fd.get("override_reason") || undefined,
  });
  if (!parsed.success) return;
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  await sb.from("leaderboard_overrides").upsert(
    {
      user_id: parsed.data.user_id,
      score_override: parsed.data.score_override ?? null,
      override_reason: parsed.data.override_reason ?? null,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  revalidatePath("/admin/leaderboard");
}

export async function banFromLeaderboardAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = z
    .object({ user_id: z.string().uuid(), reason: z.string().max(500).optional() })
    .safeParse({ user_id: fd.get("user_id"), reason: fd.get("reason") || undefined });
  if (!parsed.success) return;
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  await sb.from("leaderboard_overrides").upsert(
    {
      user_id: parsed.data.user_id,
      is_banned: true,
      ban_reason: parsed.data.reason ?? null,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  revalidatePath("/admin/leaderboard");
}

export async function clearLeaderboardOverrideAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = z
    .object({ user_id: z.string().uuid() })
    .safeParse({ user_id: fd.get("user_id") });
  if (!parsed.success) return;
  const sb = await supabaseServer();
  await sb.from("leaderboard_overrides").delete().eq("user_id", parsed.data.user_id);
  revalidatePath("/admin/leaderboard");
}

// ---------------------------------------------------------------------------
// Brokers
// ---------------------------------------------------------------------------
const brokerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  website_url: z.string().trim().max(500).optional().or(z.literal("")),
  logo_url: z.string().trim().max(500).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  is_recommended: z.coerce.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});

function readBrokerForm(fd: FormData) {
  return brokerSchema.safeParse({
    name: fd.get("name"),
    website_url: fd.get("website_url") ?? "",
    logo_url: fd.get("logo_url") ?? "",
    description: fd.get("description") ?? "",
    is_recommended: fd.get("is_recommended") === "on" || fd.get("is_recommended") === "true",
    sort_order: fd.get("sort_order") || 0,
  });
}

export async function createBrokerAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = readBrokerForm(fd);
  if (!parsed.success) return;
  const sb = await supabaseServer();
  await sb.from("brokers").insert({
    name: parsed.data.name,
    website_url: parsed.data.website_url || null,
    logo_url: parsed.data.logo_url || null,
    description: parsed.data.description || null,
    is_recommended: !!parsed.data.is_recommended,
    sort_order: parsed.data.sort_order ?? 0,
  });
  revalidatePath("/admin/brokers");
}

export async function updateBrokerAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const idParsed = userIdSchema.safeParse({ id: fd.get("id") });
  if (!idParsed.success) return;
  const parsed = readBrokerForm(fd);
  if (!parsed.success) return;
  const sb = await supabaseServer();
  await sb
    .from("brokers")
    .update({
      name: parsed.data.name,
      website_url: parsed.data.website_url || null,
      logo_url: parsed.data.logo_url || null,
      description: parsed.data.description || null,
      is_recommended: !!parsed.data.is_recommended,
      sort_order: parsed.data.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", idParsed.data.id);
  revalidatePath("/admin/brokers");
}

export async function deleteBrokerAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = userIdSchema.safeParse({ id: fd.get("id") });
  if (!parsed.success) return;
  const sb = await supabaseServer();
  await sb.from("brokers").delete().eq("id", parsed.data.id);
  revalidatePath("/admin/brokers");
}

export async function toggleBrokerActiveAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = userIdSchema.safeParse({ id: fd.get("id") });
  if (!parsed.success) return;
  const sb = await supabaseServer();
  const { data: row } = await sb
    .from("brokers")
    .select("is_active")
    .eq("id", parsed.data.id)
    .maybeSingle();
  await sb
    .from("brokers")
    .update({ is_active: !row?.is_active, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  revalidatePath("/admin/brokers");
}

export async function toggleBrokerRecommendedAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = userIdSchema.safeParse({ id: fd.get("id") });
  if (!parsed.success) return;
  const sb = await supabaseServer();
  const { data: row } = await sb
    .from("brokers")
    .select("is_recommended")
    .eq("id", parsed.data.id)
    .maybeSingle();
  await sb
    .from("brokers")
    .update({ is_recommended: !row?.is_recommended, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  revalidatePath("/admin/brokers");
}

// ---------------------------------------------------------------------------
// Broadcast announcement
// ---------------------------------------------------------------------------
// Audit M-9: action_url is stored verbatim and renders into the
// notification UI's <a href>. Previously the schema only bounded the
// length — `javascript:fetch(...)` or `data:text/html,...` would have
// parsed fine and turned admin broadcasts into a one-click XSS vector
// against every user. Require https:// explicitly; empty string is
// still allowed (no link → no <a> renders).
const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  action_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^https:\/\//i.test(v),
      { message: "Link must start with https://" },
    ),
  target_user_id: z.string().uuid().optional().or(z.literal("")),
});

export async function broadcastNotificationAction(
  _prev: { ok: boolean; message: string } | null,
  fd: FormData,
): Promise<{ ok: boolean; message: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Forbidden" };
  const parsed = broadcastSchema.safeParse({
    title: fd.get("title"),
    body: fd.get("body"),
    action_url: fd.get("action_url") ?? "",
    target_user_id: fd.get("target_user_id") ?? "",
  });
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  const sb = await supabaseServer();

  if (parsed.data.target_user_id) {
    const { error } = await sb.from("notifications").insert({
      user_id: parsed.data.target_user_id,
      type: "announcement",
      title: parsed.data.title,
      body: parsed.data.body,
      link: parsed.data.action_url || null,
      read: false,
    });
    if (error) return { ok: false, message: safeDbError(error, "Couldn't send notification.", "admin_broadcast_target") };
    return { ok: true, message: "Sent to user." };
  }

  // Broadcast — fan out across all profiles. notifications.user_id is NOT
  // NULL on the existing schema, so we insert one row per user. Acceptable
  // for current platform scale; revisit with a batched RPC if user count
  // outgrows a single statement.
  const { data: users } = await sb.from("profiles").select("id");
  const rows = (users ?? []).map((u: { id: string }) => ({
    user_id: u.id,
    type: "announcement",
    title: parsed.data.title,
    body: parsed.data.body,
    link: parsed.data.action_url || null,
    read: false,
  }));
  if (rows.length === 0) return { ok: true, message: "No users to notify." };
  const { error } = await sb.from("notifications").insert(rows);
  if (error) return { ok: false, message: safeDbError(error, "Couldn't broadcast notification.", "admin_broadcast_fanout") };
  return { ok: true, message: `Broadcast sent to ${rows.length} users.` };
}

// ---------------------------------------------------------------------------
// Dispute resolution
// ---------------------------------------------------------------------------
const resolveDisputeSchema = z.object({
  id: z.string().uuid(),
  resolution: z.enum(["resolved", "dismissed"]),
  note: z.string().trim().max(2000).optional(),
});

export async function resolveDisputeAction(fd: FormData) {
  // Audit M-12: throw instead of silent void return so the form sees
  // the failure instead of a successful-looking response.
  await requireAdminForAction();
  const parsed = resolveDisputeSchema.safeParse({
    id: fd.get("id"),
    resolution: fd.get("resolution"),
    note: fd.get("note") ?? "",
  });
  if (!parsed.success) return;

  const sb = await supabaseServer();
  const { data: { user: admin } } = await sb.auth.getUser();
  if (!admin) return;

  const { data: dispute } = await sb
    .from("disputes")
    .select("raised_by, leader_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!dispute) return;

  const { error } = await sb
    .from("disputes")
    .update({
      status: parsed.data.resolution,
      resolution_notes: parsed.data.note || null,
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return;

  const { notifyDisputeUpdate } = await import("@/lib/actions/notificationTriggers");
  await notifyDisputeUpdate(sb, dispute.raised_by as string, parsed.data.resolution);

  revalidatePath("/admin/disputes");
}
