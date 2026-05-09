// Server-side signed URL minting for trade charts.
//
// Storage buckets are private (migration 0004). The path convention is
// "<user_id>/<trade_id>/<filename>" — RLS in storage.objects requires
// the first path segment to equal auth.uid(), so users can only read
// objects they own.
//
// For lists (JournalTable, dashboard), call signCharts(paths) once with
// every path you need; supabase-js batches them into one round-trip.

import "server-only";
import { supabaseServer } from "./supabase/server";

const BUCKET = "trade-charts";
const DEFAULT_TTL_SEC = 3600; // 1 hour — re-rendered on each request

export async function signCharts(
  paths: string[],
  ttlSec: number = DEFAULT_TTL_SEC,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (paths.length === 0) return out;
  const sb = await supabaseServer();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, ttlSec);
  if (error || !data) return out;
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) {
      out[item.path] = item.signedUrl;
    }
  }
  return out;
}

export async function signChart(path: string, ttlSec: number = DEFAULT_TTL_SEC): Promise<string | null> {
  const map = await signCharts([path], ttlSec);
  return map[path] ?? null;
}
