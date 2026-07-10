import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncConnection } from "@/lib/metaapi/sync";
import { verifyCronAuth } from "@/lib/cron/auth";

// Vercel cron — MetaApi cloud-capture sync.
// Polls every ACTIVE metaapi_connections row (read-only MetaStats) and upserts
// its trades via syncConnection. Mirrors the recalculate-scores cron: same
// CRON_SECRET guard (verifyCronAuth), same shape. READ-ONLY: no deploy/undeploy
// orchestration here — that lands as a later piece. This route only reads
// broker data and writes to our own trades table.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;

  const sb = supabaseAdmin();

  const { data: connections, error } = await sb
    .from("metaapi_connections")
    .select("id")
    .eq("status", "active");

  if (error) {
    console.error("MetaApi cron: failed to fetch active connections", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  let succeeded = 0;
  let failed = 0;
  let imported = 0;
  let skipped = 0;

  for (const conn of connections ?? []) {
    try {
      const outcome = await syncConnection(conn.id);
      if (outcome.ok) {
        succeeded++;
      } else {
        failed++;
        console.error(`MetaApi cron: sync failed for connection ${conn.id}`, outcome.error);
      }
      imported += outcome.imported;
      skipped += outcome.skipped;
    } catch (err) {
      failed++;
      console.error(`MetaApi cron: sync threw for connection ${conn.id}`, err);
    }
  }

  console.log(
    `MetaApi cron complete: ${succeeded} ok, ${failed} failed, ${imported} imported, ${skipped} skipped`,
  );
  return NextResponse.json({
    succeeded,
    failed,
    imported,
    skipped,
    total: (connections ?? []).length,
  });
}
