// Server-side signed URL minting for private storage buckets.
//
// Storage buckets (avatars, trade-charts) are private (migration 0004).
// The path convention is "<user_id>/..." — RLS in storage.objects requires
// the first segment to equal auth.uid(), so users can only read/write
// their own objects.
//
// For lists (JournalTable, leaderboard), call signMany once with every
// path you need; supabase-js batches them into one round-trip.

import "server-only";
import { supabaseServer } from "./supabase/server";

const DEFAULT_TTL_SEC = 3600; // 1 hour — re-rendered on each request

type Bucket = "trade-charts" | "avatars";

async function signMany(
  bucket: Bucket,
  paths: string[],
  ttlSec: number,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (paths.length === 0) return out;
  const sb = await supabaseServer();
  const { data, error } = await sb.storage.from(bucket).createSignedUrls(paths, ttlSec);
  if (error || !data) return out;
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) {
      out[item.path] = item.signedUrl;
    }
  }
  return out;
}

async function signOne(bucket: Bucket, path: string, ttlSec: number): Promise<string | null> {
  const map = await signMany(bucket, [path], ttlSec);
  return map[path] ?? null;
}

export const signCharts = (paths: string[], ttl = DEFAULT_TTL_SEC) => signMany("trade-charts", paths, ttl);
export const signChart = (path: string, ttl = DEFAULT_TTL_SEC) => signOne("trade-charts", path, ttl);
export const signAvatars = (paths: string[], ttl = DEFAULT_TTL_SEC) => signMany("avatars", paths, ttl);
export const signAvatar = (path: string, ttl = DEFAULT_TTL_SEC) => signOne("avatars", path, ttl);
