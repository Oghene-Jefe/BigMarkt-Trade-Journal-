import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/cron/auth";

// Vercel cron — runs daily at 03:00 UTC.
// Prunes two append-only housekeeping tables that grow unbounded without
// periodic cleanup:
//   • ea_request_nonces  — replay-protection nonces older than 10 minutes
//   • abuse_log          — rate-limit ledger entries older than 7 days
// Both RPCs are SECURITY DEFINER and revoked from public; must be called
// via the service role. Protected by CRON_SECRET via `verifyCronAuth`
// (constant-time compare — audit findings H-8 + H-9).

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;

  const sb = supabaseAdmin();

  const [noncesRes, abuseRes] = await Promise.all([
    sb.rpc("cleanup_ea_request_nonces"),
    sb.rpc("cleanup_abuse_log"),
  ]);

  if (noncesRes.error) {
    console.error("Cron cleanup: cleanup_ea_request_nonces failed", noncesRes.error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (abuseRes.error) {
    console.error("Cron cleanup: cleanup_abuse_log failed", abuseRes.error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const noncesDeleted = noncesRes.data as number;
  const abuseDeleted = abuseRes.data as number;

  console.log(
    `Cron cleanup complete: ea_request_nonces=${noncesDeleted} rows deleted, ` +
      `abuse_log=${abuseDeleted} rows deleted`,
  );

  return NextResponse.json({
    ea_request_nonces_deleted: noncesDeleted,
    abuse_log_deleted: abuseDeleted,
  });
}
