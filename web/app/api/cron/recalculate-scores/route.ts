import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recalculateAccountScoreWithClient } from "@/lib/scoring-recalculate";
import { verifyCronAuth } from "@/lib/cron/auth";

// Vercel cron — runs daily at 02:00 UTC.
// Recalculates scores for every broker account with auto_verified trades in
// the last 24 hours. Protected by CRON_SECRET via `verifyCronAuth`
// (constant-time compare — audit findings H-8 + H-9).

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;

  const sb = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: activeRows, error } = await sb
    .from("trades")
    .select("broker_account_id, user_id")
    .eq("trust_badge", "auto_verified")
    .gte("created_at", since)
    .not("broker_account_id", "is", null);

  if (error) {
    console.error("Cron: failed to fetch active accounts", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // Deduplicate by broker_account_id (keep the first user_id seen per account)
  const seen = new Map<string, string>();
  for (const row of activeRows ?? []) {
    if (row.broker_account_id && !seen.has(row.broker_account_id)) {
      seen.set(row.broker_account_id, row.user_id);
    }
  }

  let succeeded = 0;
  let failed = 0;

  for (const [accountId, userId] of seen) {
    const result = await recalculateAccountScoreWithClient(sb, userId, accountId);
    if ("error" in result) {
      console.error(`Cron: recalc failed for account ${accountId}`, result.error);
      failed++;
    } else {
      succeeded++;
    }
  }

  console.log(`Cron recalc complete: ${succeeded} succeeded, ${failed} failed`);
  return NextResponse.json({ succeeded, failed, total: seen.size });
}
