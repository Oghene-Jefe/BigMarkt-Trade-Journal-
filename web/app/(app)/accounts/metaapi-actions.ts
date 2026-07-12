"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { isAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { callerIp, checkAndLog } from "@/lib/abuse";
import { safeDbError } from "@/lib/db-error";
import { createAccount, searchKnownServers } from "@/lib/metaapi/provisioning";
import { syncConnection } from "@/lib/metaapi/sync";
import { advanceProvisioning } from "@/lib/metaapi/advance";

// Full auto-provision server action (fire-and-poll). Creates a MetaApi cloud
// account from a broker server + login + INVESTOR (read-only) password, records
// it as a broker_accounts row + a metaapi_connections row in status
// 'provisioning', and returns fast. The metaapi-sync cron advances the row to
// 'active' once MetaApi finishes broker detection + deploy.
//
// The investor password is passed to MetaApi and then DISCARDED — it is never
// written to the database (readonly_password stays NULL) and never logged.

const MT5_VERSION = 5;

const provisionSchema = z.object({
  label: z.string().min(1).max(50).transform((s) => s.trim()),
  broker_slug: z.string().min(1).max(50).transform((s) => s.trim()),
  account_type: z.enum(["live", "demo", "prop_firm"]),
  server: z.string().min(1).max(120).transform((s) => s.trim()),
  login: z
    .string()
    .min(1)
    .max(32)
    .regex(/^\d+$/, "Login must be digits only")
    .transform((s) => s.trim()),
  investor_password: z.string().min(1).max(200),
  // Set to "true" when the user has been shown "server not found" once and
  // chooses to proceed with the server name as typed (it may be unlisted).
  confirm_unknown_server: z.enum(["true", "false"]).optional(),
});

export type ProvisionResult =
  | { ok: true; connectionId: string }
  | { ok: false; error: string; serverSuggestions?: string[] };

function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) obj[k] = typeof v === "string" ? v : "";
  return obj;
}

// MetaApi returns bad-server suggestions grouped by broker; shape isn't strictly
// documented, so read defensively from the common locations.
function extractServerSuggestions(body: unknown): string[] | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  const candidates = [
    b.serversByBrokers,
    (b.metadata as Record<string, unknown> | undefined)?.serversByBrokers,
    (b.details as Record<string, unknown> | undefined)?.serversByBrokers,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object") {
      const flat = Object.values(c as Record<string, unknown>)
        .flat()
        .filter((s): s is string => typeof s === "string");
      if (flat.length) return flat.slice(0, 12);
    }
  }
  return undefined;
}

function friendlyProvisionError(status: number, raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("otp") || lower.includes("one-time password") || lower.includes("two-factor")) {
    return "This account has two-factor (OTP) login enabled, which cloud sync can't support. Use the EA method instead.";
  }
  if (status === 400) {
    return `Couldn't connect: ${raw}. Double-check the server name, login, and that you're using the INVESTOR (read-only) password.`;
  }
  if (status === 401 || status === 403) {
    return "MetaApi provisioning isn't configured correctly on our side. Please contact support.";
  }
  return `Couldn't connect to the broker (${raw}). Please try again shortly.`;
}

export async function provisionConnectionAction(
  formData: FormData,
): Promise<ProvisionResult> {
  const user = await requireUser();

  // TEMPORARY entitlement gate. Each cloud provision costs real MetaApi money
  // per account and Pro/payments (Phase D) aren't live yet — so restrict to
  // admins during testing. Replace with a Pro-entitlement check when Phase D
  // ships. See CURRENT_STATE "MetaApi Integration".
  if (!(await isAdmin())) {
    return { ok: false, error: "Cloud connect is currently limited to admins during testing." };
  }

  const parsed = provisionSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  // The write-scoped provisioning token is required. A provisioning profile is
  // NOT — MetaApi auto-detects the broker from the server name in most cases;
  // METAAPI_MT5_PROVISIONING_PROFILE_ID is optional, only for unusual brokers.
  if (!process.env.METAAPI_PROVISIONING_TOKEN) {
    return { ok: false, error: "Cloud connect isn't configured yet. Please contact support." };
  }
  const profileId = process.env.METAAPI_MT5_PROVISIONING_PROFILE_ID;

  // Burst/abuse guard: provisioning triggers billable MetaApi calls, and MetaApi
  // charges for excessive errors. Cap attempts per IP (fail-closed). email:null
  // is deliberate — checkAndLog's email path is duplicate suppression, which
  // would wrongly block a user connecting a second account or retrying.
  const rate = await checkAndLog(supabaseAdmin(), {
    scope: "metaapi_provision",
    ip: await callerIp(),
    email: null,
    ipLimit: 10,
    ipWindowSec: 3600,
  });
  if (!rate.ok) {
    return {
      ok: false,
      error:
        rate.reason === "rate_limited"
          ? "Too many connection attempts. Please wait a while and try again."
          : "Couldn't process that right now. Please try again shortly.",
    };
  }

  // 1. Validate the server (avoids a billed create error), unless the user
  //    already confirmed an unlisted server. A failed lookup (network) does NOT
  //    block — we let create be the source of truth in that case.
  if (input.confirm_unknown_server !== "true") {
    const known = await searchKnownServers({ version: MT5_VERSION, query: input.server });
    if (known.ok) {
      const all = Object.values(known.data).flat();
      const exact = all.some((s) => s.toLowerCase() === input.server.toLowerCase());
      if (!exact) {
        return {
          ok: false,
          error: `We couldn't find a server named "${input.server}". Pick a suggestion below, or resubmit to use it exactly as typed.`,
          serverSuggestions: all.slice(0, 12),
        };
      }
    }
  }

  const sb = await supabaseServer();

  // 2. Create the broker_accounts row (RLS self). Investor password NOT stored.
  // Cloud connections are ALWAYS automated journaling — the cron captures trades
  // server-side. Prop firms ARE allowed automated journaling here (unlike the
  // EA/manual path): cloud capture is READ-ONLY (investor password + GET-only
  // MetaStats), so nothing ever executes on the prop account. is_prop_firm is
  // still set below, which keeps the prop_firm trust badge and the (deferred)
  // copy-execution lock in force. Journaling is allowed; copy execution is not.
  const journalMode = "automated";
  const { data: acct, error: acctErr } = await sb
    .from("broker_accounts")
    .insert({
      user_id: user.id,
      label: input.label,
      broker_slug: input.broker_slug,
      account_type: input.account_type,
      journal_mode: journalMode,
      is_prop_firm: input.account_type === "prop_firm",
      account_number: input.login,
      readonly_password: null,
    })
    .select("id")
    .single();

  if (acctErr || !acct) {
    return { ok: false, error: safeDbError(acctErr, "Couldn't create the account.", "metaapi_broker_insert") };
  }

  // 3. Provision the MetaApi cloud account with the INVESTOR password.
  const created = await createAccount({
    login: input.login,
    investorPassword: input.investor_password,
    server: input.server,
    name: `${input.label} (${input.login})`.slice(0, 64),
    provisioningProfileId: profileId,
  });

  if (!created.ok) {
    // Roll back the broker_account so a failed provision leaves nothing behind.
    await sb.from("broker_accounts").delete().eq("id", acct.id).eq("user_id", user.id);
    return {
      ok: false,
      error: friendlyProvisionError(created.status, created.error),
      serverSuggestions: extractServerSuggestions(created.body),
    };
  }

  // 4. Record the connection as 'provisioning'. The cron advances it to 'active'.
  const { data: conn, error: connErr } = await sb
    .from("metaapi_connections")
    .insert({
      user_id: user.id,
      broker_account_id: acct.id,
      metaapi_account_id: created.data.id,
      region: null,
      broker_server: input.server,
      login: input.login,
      status: "provisioning",
    })
    .select("id")
    .single();

  if (connErr || !conn) {
    // The MetaApi account exists but we couldn't record it — log for manual
    // cleanup; do NOT delete the broker_account (keeps a trace to reconcile).
    console.error("metaapi provision: connection insert failed after account create", {
      metaapiAccountId: created.data.id,
      brokerAccountId: acct.id,
      code: connErr?.code,
    });
    return {
      ok: false,
      error: safeDbError(
        connErr,
        "Your cloud account was created but we couldn't finish linking it. Please contact support.",
        "metaapi_connection_insert",
      ),
    };
  }

  // input.investor_password leaves scope here — never persisted, never logged.
  revalidatePath("/accounts");
  return { ok: true, connectionId: conn.id };
}

// Live server autocomplete for the Connect-via-cloud form. Admin-gated (same as
// provisioning). Wraps the cheap GET known-servers lookup; returns a flat,
// deduped, capped list of server names. Never throws to the client.
export async function searchServersAction(query: string): Promise<string[]> {
  if (!(await isAdmin())) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await searchKnownServers({ version: 5, query: q });
  if (!res.ok) return [];
  const all = Object.values(res.data)
    .flat()
    .filter((s): s is string => typeof s === "string");
  return Array.from(new Set(all)).slice(0, 12);
}

export type SyncNowResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// Owner-triggered manual sync/advance for a cloud connection. Lets a user (or
// admin) pull fresh trades immediately instead of waiting for the daily cron.
// Ownership is enforced by the RLS-scoped read below.
export async function syncNowAction(connectionId: string): Promise<SyncNowResult> {
  const user = await requireUser();
  const sb = await supabaseServer();
  const { data: conn } = await sb
    .from("metaapi_connections")
    .select("id, status")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conn) return { ok: false, error: "Connection not found." };

  const status = (conn as { status: string }).status;

  if (status === "provisioning") {
    const adv = await advanceProvisioning(connectionId);
    if (adv.status === "active") {
      const s = await syncConnection(connectionId);
      revalidatePath("/accounts");
      revalidatePath("/journal");
      return { ok: true, message: `Connected — imported ${s.imported} trade${s.imported === 1 ? "" : "s"}.` };
    }
    revalidatePath("/accounts");
    return adv.status === "error"
      ? { ok: false, error: "Connection failed — check the account details and reconnect." }
      : { ok: true, message: "Still setting up… give it a minute and try again." };
  }

  if (status === "active") {
    const s = await syncConnection(connectionId);
    revalidatePath("/accounts");
    revalidatePath("/journal");
    if (!s.ok) return { ok: false, error: s.error ?? "Sync failed. Try again shortly." };
    return { ok: true, message: `Synced — ${s.imported} imported${s.skipped ? `, ${s.skipped} skipped` : ""}.` };
  }

  return { ok: false, error: `This connection is ${status} and can't sync right now.` };
}
