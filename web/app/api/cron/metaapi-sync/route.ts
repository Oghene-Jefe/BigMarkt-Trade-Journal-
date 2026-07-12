import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { advanceProvisioning } from "@/lib/metaapi/advance";
import { readAccount, undeployAccount } from "@/lib/metaapi/provisioning";
import { verifyCronAuth } from "@/lib/cron/auth";

// Vercel cron — MetaApi cloud-capture maintenance (daily on Hobby).
// Phase 1: advance any 'provisioning' connection toward 'active'.
// Phase 2: COST CLEANUP — under the undeploy-when-idle model, cloud accounts are
// deployed only during an on-demand Sync (client-driven via cloudSyncStep). This
// pass undeploys any 'active' account left DEPLOYED (a just-activated provision,
// or an abandoned Sync-now session) so it stops billing hosting. It does NOT sync
// here: deploying takes minutes and a cron invocation can't wait. Automatic
// scheduled sync (every ~6h) returns once Vercel Pro allows a frequent cron.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;

  const sb = supabaseAdmin();

  // Phase 1 — advance provisioning connections.
  let activated = 0;
  let advanceFailed = 0;
  const { data: pending } = await sb
    .from("metaapi_connections")
    .select("id")
    .eq("status", "provisioning");
  for (const conn of pending ?? []) {
    try {
      const o = await advanceProvisioning(conn.id);
      if (o.status === "active") activated++;
      if (o.status === "error") advanceFailed++;
    } catch (err) {
      advanceFailed++;
      console.error(`MetaApi cron: advance threw for ${conn.id}`, err);
    }
  }

  // Phase 2 — undeploy any stranded-deployed active accounts (cost cleanup).
  let undeployed = 0;
  const { data: active } = await sb
    .from("metaapi_connections")
    .select("id, metaapi_account_id")
    .eq("status", "active");
  for (const conn of (active ?? []) as { id: string; metaapi_account_id: string }[]) {
    try {
      const acct = await readAccount(conn.metaapi_account_id);
      if (!acct.ok) continue;
      const state = acct.data.state ?? "";
      if (state === "DEPLOYED" || state === "DEPLOYING") {
        const r = await undeployAccount(conn.metaapi_account_id);
        if (r.ok) undeployed++;
      }
    } catch (err) {
      console.error(`MetaApi cron: cleanup threw for ${conn.id}`, err);
    }
  }

  console.log(
    `MetaApi cron: advanced ${activated} / ${advanceFailed} failed; undeployed ${undeployed} idle accounts`,
  );
  return NextResponse.json({ activated, advanceFailed, undeployed });
}
