import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncConnection } from "@/lib/metaapi/sync";
import { advanceProvisioning } from "@/lib/metaapi/advance";
import { verifyCronAuth } from "@/lib/cron/auth";

// Vercel cron — MetaApi cloud-capture.
// Phase 1 (fire-and-poll advancement): advances every 'provisioning' connection
// (read state, enable MetaStats, set region, flip to 'active' when ready).
// Phase 2 (sync): polls every 'active' connection (read-only MetaStats) and
// upserts its trades. Advancement runs first so a just-activated account syncs
// in the same run. Same CRON_SECRET guard as the other crons. READ-ONLY capture:
// the only writes to MetaApi are account provisioning (create/enable/deploy in
// phase 1) — never a trade.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;

  const sb = supabaseAdmin();

  // ── Phase 1: advance provisioning connections ──────────────────────────────
  let activated = 0;
  let advanceFailed = 0;
  const { data: pending, error: pendingErr } = await sb
    .from("metaapi_connections")
    .select("id")
    .eq("status", "provisioning");

  if (pendingErr) {
    console.error("MetaApi cron: failed to fetch provisioning connections", pendingErr);
  } else {
    for (const conn of pending ?? []) {
      try {
        const outcome = await advanceProvisioning(conn.id);
        if (outcome.status === "active") activated++;
        if (outcome.status === "error") advanceFailed++;
      } catch (err) {
        advanceFailed++;
        console.error(`MetaApi cron: advance threw for connection ${conn.id}`, err);
      }
    }
  }

  // ── Phase 2: sync active connections ───────────────────────────────────────
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
    `MetaApi cron complete: advanced ${activated} activated / ${advanceFailed} failed; ` +
      `synced ${succeeded} ok, ${failed} failed, ${imported} imported, ${skipped} skipped`,
  );
  return NextResponse.json({
    activated,
    advanceFailed,
    succeeded,
    failed,
    imported,
    skipped,
    total: (connections ?? []).length,
  });
}
