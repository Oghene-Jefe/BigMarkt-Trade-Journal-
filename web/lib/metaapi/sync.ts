// MetaApi sync writer — poll one connection, upsert its trades.
//
// Pure function: syncConnection(connectionId) does ONE poll cycle for ONE
// connection. It is called by the cron (piece 4) or an admin "sync now" action.
// No schedule, no loop over connections here — one responsibility.
//
// READ-ONLY capture: uses only the GET-only MetaStats client. Writes go to our
// OWN trades table via the service-role client, never back to MetaApi.
//
// Keying (conservative v1): upsert on (user_id, position_id) — the SAME partial
// unique index the EA uses (idx_trades_user_position_unique) — so MetaApi and EA
// trades dedupe on identical keys and all downstream systems work unchanged. A
// closed trade with NO position_id is logged and SKIPPED in v1 (counted in the
// sync run). If the live probe shows closed trades lack position_id, that's when
// we add an external_id column (migration 0084) and flip skip→write.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getHistoricalTrades, getOpenTrades } from "@/lib/metaapi/client";
import { metaApiTradeKey, normalizeClosedTrade, normalizeOpenTrade } from "@/lib/metaapi/normalize";

// How far back each poll re-scans closed trades. A rolling window (like the EA's
// ReconcileDays) so a close missed during a gap still gets picked up next poll.
const HISTORY_WINDOW_DAYS = 30;

type ConnectionRow = {
  id: string;
  user_id: string;
  broker_account_id: string;
  metaapi_account_id: string;
  region: string | null;
  status: string;
};

// Shared READ-scoped MetaApi token (Path A). One token reads every account under
// BigMarkt's MetaApi user — each request is scoped by the accountId in the
// MetaStats URL, so no per-connection token is stored. Never logged.
function readerToken(): string {
  const t = process.env.METAAPI_READER_TOKEN;
  if (!t) {
    throw new Error(
      "METAAPI_READER_TOKEN is not set. Add a READ-scoped MetaApi token " +
        "(metastats-api + reader role) to the server env (Vercel Production + Preview).",
    );
  }
  return t;
}

export type SyncOutcome = {
  ok: boolean;
  connectionId: string;
  imported: number;   // trades upserted (new + updated)
  skipped: number;    // trades skipped (no position_id in v1)
  error?: string;
};

// Derive trust_badge from the broker account type — identical mapping to the EA
// route so cloud trades badge the same as EA trades.
function trustBadgeFor(accountType: string | null): string {
  return accountType === "prop_firm" ? "prop_firm"
    : accountType === "demo" ? "demo"
    : "auto_verified";
}

// Upsert one normalized trade row on (user_id, position_id). Manual
// lookup-then-write (not .upsert()) to mirror the EA route's pattern and stay
// off the immutability trigger's toes: we only INSERT new positions here; an
// existing open row being closed is handled by the field diff on update.
async function upsertByPosition(
  supabase: SupabaseClient,
  args: {
    userId: string;
    brokerAccountId: string;
    positionId: string;
    trustBadge: string;
    row: Record<string, unknown>;
  },
): Promise<"inserted" | "updated" | "error"> {
  const { data: existing, error: lookupErr } = await supabase
    .from("trades")
    .select("id, status")
    .eq("user_id", args.userId)
    .eq("position_id", args.positionId)
    .maybeSingle();
  if (lookupErr) {
    console.error("metaapi sync: lookup failed", { code: lookupErr.code, message: lookupErr.message });
    return "error";
  }

  const fullRow = {
    ...args.row,
    user_id: args.userId,
    broker_account_id: args.brokerAccountId,
    position_id: args.positionId,
    trust_badge: args.trustBadge,
    core_fields_locked: true,
    auto_approved: true,
    visibility: "private",   // v1: never auto-share; opt-in wired later
  };

  if (existing?.id) {
    // Don't clobber a row already closed with a re-sent open snapshot.
    if ((existing as { status?: string | null }).status === "closed"
        && args.row.status === "open") {
      return "updated";
    }
    const { error: updErr } = await supabase
      .from("trades")
      .update(fullRow)
      .eq("id", existing.id)
      .eq("user_id", args.userId);
    if (updErr) {
      console.error("metaapi sync: update failed", { code: updErr.code, message: updErr.message });
      return "error";
    }
    return "updated";
  }

  const { error: insErr } = await supabase.from("trades").insert(fullRow);
  if (insErr) {
    console.error("metaapi sync: insert failed", { code: insErr.code, message: insErr.message });
    return "error";
  }
  return "inserted";
}

export async function syncConnection(connectionId: string): Promise<SyncOutcome> {
  const supabase = supabaseAdmin();

  // 1. Load the connection.
  const { data: conn, error: connErr } = await supabase
    .from("metaapi_connections")
    .select("id, user_id, broker_account_id, metaapi_account_id, region, status")
    .eq("id", connectionId)
    .maybeSingle();

  if (connErr || !conn) {
    return { ok: false, connectionId, imported: 0, skipped: 0, error: "connection not found" };
  }
  const c = conn as unknown as ConnectionRow;

  if (c.status === "paused" || c.status === "revoked") {
    return { ok: false, connectionId, imported: 0, skipped: 0, error: `connection is ${c.status}` };
  }
  if (!c.region) {
    return { ok: false, connectionId, imported: 0, skipped: 0, error: "connection has no region" };
  }

  // 2. Open a sync-run row (running).
  const startedAt = new Date();
  const windowEnd = startedAt;
  const windowStart = new Date(startedAt.getTime() - HISTORY_WINDOW_DAYS * 24 * 3600 * 1000);

  const { data: runRow } = await supabase
    .from("metaapi_sync_runs")
    .insert({
      user_id: c.user_id,
      connection_id: c.id,
      status: "running",
      started_at: startedAt.toISOString(),
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
    })
    .select("id")
    .single();
  const runId = runRow?.id ?? null;

  const finish = async (
    status: "success" | "partial" | "failed",
    imported: number,
    skipped: number,
    errorMessage?: string,
  ): Promise<SyncOutcome> => {
    if (runId) {
      await supabase
        .from("metaapi_sync_runs")
        .update({
          status,
          finished_at: new Date().toISOString(),
          imported_count: imported,
          skipped_count: skipped,
          error_message: errorMessage ?? null,
        })
        .eq("id", runId);
    }
    await supabase
      .from("metaapi_connections")
      .update({
        status: status === "failed" ? "error" : "active",
        last_sync_at: new Date().toISOString(),
        last_error: errorMessage ?? null,
      })
      .eq("id", c.id);
    return { ok: status !== "failed", connectionId, imported, skipped, error: errorMessage };
  };

  // 3. Load the shared read-scoped token (Path A). In memory only; never logged.
  let token: string;
  try {
    token = readerToken();
  } catch (e) {
    return finish("failed", 0, 0, e instanceof Error ? e.message : "reader token unavailable");
  }

  // 4. Resolve broker account type for trust_badge.
  const { data: acct } = await supabase
    .from("broker_accounts")
    .select("account_type")
    .eq("id", c.broker_account_id)
    .eq("user_id", c.user_id)
    .maybeSingle();
  const trustBadge = trustBadgeFor((acct?.account_type as string | null) ?? null);

  let imported = 0;
  let skipped = 0;
  let hadError = false;

  // 5. Closed / historical trades.
  const hist = await getHistoricalTrades({
    region: c.region,
    token,
    accountId: c.metaapi_account_id,
    from: windowStart,
    to: windowEnd,
  });
  if (!hist.ok) {
    return finish("failed", imported, skipped, `historical fetch: ${hist.error}`);
  }
  for (const t of hist.data) {
    const key = metaApiTradeKey(t);
    if (!key.position_id) { skipped++; continue; }   // v1: no external_id column yet
    const row = normalizeClosedTrade(t);
    if ("error" in row) { skipped++; continue; }
    const r = await upsertByPosition(supabase, {
      userId: c.user_id,
      brokerAccountId: c.broker_account_id,
      positionId: key.position_id,
      trustBadge,
      row,
    });
    if (r === "error") hadError = true; else imported++;
  }

  // 6. Open trades.
  const open = await getOpenTrades({
    region: c.region,
    token,
    accountId: c.metaapi_account_id,
  });
  if (!open.ok) {
    // Closed data already imported — report partial rather than fail outright.
    return finish("partial", imported, skipped, `open fetch: ${open.error}`);
  }
  for (const t of open.data) {
    const key = metaApiTradeKey(t);
    if (!key.position_id) { skipped++; continue; }
    const row = normalizeOpenTrade(t);
    if ("error" in row) { skipped++; continue; }
    const r = await upsertByPosition(supabase, {
      userId: c.user_id,
      brokerAccountId: c.broker_account_id,
      positionId: key.position_id,
      trustBadge,
      row,
    });
    if (r === "error") hadError = true; else imported++;
  }

  return finish(hadError ? "partial" : "success", imported, skipped);
}
