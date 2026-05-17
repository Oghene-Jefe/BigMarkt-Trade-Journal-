import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Vercel cron — runs daily at 03:00 UTC.
// Prunes two append-only housekeeping tables that grow unbounded without
// periodic cleanup:
//   • ea_request_nonces  — replay-protection nonces older than 10 minutes
//   • abuse_log          — rate-limit ledger entries older than 7 days
// Both RPCs are SECURITY DEFINER and revoked from public; must be called
// via the service role. Protected by CRON_SECRET — Vercel sets the
// "Authorization: Bearer ${CRON_SECRET}" header automatically on cron
// invocations.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Misconfigured deploy: never let an unset secret degrade into accepting
  // `Authorization: Bearer undefined`. Template-literally that's a real,
  // matchable string — so prior code accepted any caller who supplied it.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set — refusing to run cron");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();

  const [noncesRes, abuseRes] = await Promise.all([
    sb.rpc("cleanup_ea_request_nonces"),
    sb.rpc("cleanup_abuse_log"),
  ]);

  if (noncesRes.error) {
    console.error("Cron cleanup: cleanup_ea_request_nonces failed", noncesRes.error);
    return NextResponse.json({ error: noncesRes.error.message }, { status: 500 });
  }
  if (abuseRes.error) {
    console.error("Cron cleanup: cleanup_abuse_log failed", abuseRes.error);
    return NextResponse.json({ error: abuseRes.error.message }, { status: 500 });
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
