"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { decryptCredential } from "@/lib/exchanges/crypto";
import { splitIntoSevenDayWindows } from "@/lib/exchanges/bybit/windows";
import {
  syncClosedPnlForWindow,
  syncExecutionsForWindow,
  type SyncCounts,
} from "@/lib/exchanges/bybit/sync";
import { BybitApiError, BybitHttpError } from "@/lib/exchanges/bybit/client";

const idSchema = z.object({ id: z.string().uuid() });

// Phase D scope: a single click syncs **at most 7 days** to keep the action
// inside Vercel's serverless timeout budget. The default window is:
//   - first sync: last 7 days
//   - subsequent syncs: last_sync_at - 1 day → now (1-day overlap to catch
//                       late-arriving rows; dedupe handles repeats)
// "Backfill older history" is a Phase F feature that issues multiple
// 7-day windows from a separate UI button.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export async function syncBybitAction(formData: FormData) {
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  const connectionId = parsed.data.id;

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  // Load the connection (RLS-scoped, so this only succeeds for the owner).
  const { data: conn, error: connErr } = await sb
    .from("exchange_connections")
    .select(
      "id, user_id, exchange, environment, encrypted_api_key, encrypted_api_secret, key_salt, last_sync_at, status",
    )
    .eq("id", connectionId)
    .single();

  if (connErr || !conn) return;
  if (conn.user_id !== user.id) return; // belt and braces

  // Determine the sync window.
  const nowMs = Date.now();
  const lastSyncMs = conn.last_sync_at ? new Date(conn.last_sync_at).getTime() : null;
  const windowStartMs = lastSyncMs
    ? Math.max(lastSyncMs - ONE_DAY_MS, nowMs - SEVEN_DAYS_MS)
    : nowMs - SEVEN_DAYS_MS;
  const windows = splitIntoSevenDayWindows(windowStartMs, nowMs);

  // Decrypt creds (never persist these).
  const salt = Buffer.from(conn.key_salt, "base64");
  const apiKey = decryptCredential(conn.encrypted_api_key, user.id, salt);
  const apiSecret = decryptCredential(conn.encrypted_api_secret, user.id, salt);

  // Open a sync run row so the user can see what happened even if we crash.
  const { data: runRow, error: runErr } = await sb
    .from("exchange_sync_runs")
    .insert({
      user_id: user.id,
      connection_id: conn.id,
      exchange: conn.exchange,
      environment: conn.environment,
      category: "linear",
      status: "running",
      window_start: new Date(windowStartMs).toISOString(),
      window_end: new Date(nowMs).toISOString(),
    })
    .select("id")
    .single();
  if (runErr || !runRow) return;
  const syncRunId = runRow.id;

  let totalImported = 0;
  let totalSkipped = 0;
  let errorMessage: string | null = null;

  try {
    for (const w of windows) {
      const args = {
        sb,
        creds: { apiKey, apiSecret },
        env: conn.environment as "mainnet" | "testnet",
        category: "linear" as const,
        userId: user.id,
        connectionId: conn.id,
        syncRunId,
        startMs: w.startMs,
        endMs: w.endMs,
      };
      const cp: SyncCounts = await syncClosedPnlForWindow(args);
      const ex: SyncCounts = await syncExecutionsForWindow(args);
      totalImported += cp.inserted + ex.inserted;
      totalSkipped += cp.duplicates + ex.duplicates;
    }
  } catch (e) {
    if (e instanceof BybitApiError) {
      errorMessage = `Bybit ${e.retCode}: ${e.retMsg}`;
    } else if (e instanceof BybitHttpError) {
      errorMessage = `Bybit HTTP ${e.status}`;
    } else if (e instanceof Error) {
      errorMessage = e.message;
    } else {
      errorMessage = "unknown error";
    }
  }

  // Close the sync run.
  const finalStatus = errorMessage
    ? totalImported > 0
      ? "partial"
      : "failed"
    : "success";

  await sb.from("exchange_sync_runs")
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      imported_count: totalImported,
      skipped_count: totalSkipped,
      error_message: errorMessage,
    })
    .eq("id", syncRunId);

  // Update connection's last_sync_at + last_error.
  await sb.from("exchange_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_error: errorMessage,
      status: errorMessage && totalImported === 0 ? "error" : "active",
    })
    .eq("id", conn.id);

  revalidatePath("/exchanges");
}
