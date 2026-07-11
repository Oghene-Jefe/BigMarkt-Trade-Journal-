// MetaApi provisioning advancer — one fire-and-poll step for ONE connection.
//
// A connection is created in status 'provisioning' by provisionConnectionAction.
// This module (called by the metaapi-sync cron) reads the MetaApi account state
// and advances the row: persists the assigned region, enables MetaStats once the
// account is deployed, and flips to 'active' once it's deployed AND connected AND
// MetaStats is enabled. Deploy failures become 'error'. Transient read failures
// leave the row untouched (never a false transition).
//
// Uses the write-scoped provisioning client (create/enable/deploy/read). No trade
// execution — provisioning only.

import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readAccount, enableMetaStats } from "@/lib/metaapi/provisioning";

type ProvisioningConnRow = {
  id: string;
  user_id: string;
  metaapi_account_id: string;
  region: string | null;
  status: string;
};

export type AdvanceOutcome = {
  connectionId: string;
  status: "provisioning" | "active" | "error";
  changed: boolean;
  note?: string;
};

export async function advanceProvisioning(connectionId: string): Promise<AdvanceOutcome> {
  const sb = supabaseAdmin();

  const { data: conn } = await sb
    .from("metaapi_connections")
    .select("id, user_id, metaapi_account_id, region, status")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn) return { connectionId, status: "error", changed: false, note: "connection not found" };

  const c = conn as unknown as ProvisioningConnRow;
  if (c.status !== "provisioning") {
    return { connectionId, status: c.status === "active" ? "active" : "error", changed: false };
  }

  const acct = await readAccount(c.metaapi_account_id);
  if (!acct.ok) {
    // Transient — record for visibility, do NOT flip status.
    await sb.from("metaapi_connections").update({ last_error: `state check: ${acct.error}` }).eq("id", c.id);
    return { connectionId, status: "provisioning", changed: false, note: acct.error };
  }

  const a = acct.data;
  const region = typeof a.region === "string" && a.region ? a.region : null;
  const state = a.state ?? "";
  const connectionStatus = a.connectionStatus ?? "";
  const metastats = a.metastatsApiEnabled === true;
  const regionPatch = region && region !== c.region ? { region } : {};

  if (state === "DEPLOY_FAILED") {
    await sb
      .from("metaapi_connections")
      .update({
        ...regionPatch,
        status: "error",
        last_error: "MetaApi deployment failed. Check the login, investor password, and server, then reconnect.",
      })
      .eq("id", c.id);
    return { connectionId, status: "error", changed: true, note: "deploy failed" };
  }

  if (!metastats) {
    if (state === "DEPLOYED") {
      const enabled = await enableMetaStats(c.metaapi_account_id);
      if (!enabled.ok) {
        await sb
          .from("metaapi_connections")
          .update({ ...regionPatch, last_error: `enable metastats: ${enabled.error}` })
          .eq("id", c.id);
        return { connectionId, status: "provisioning", changed: false, note: enabled.error };
      }
      await sb.from("metaapi_connections").update({ ...regionPatch, last_error: null }).eq("id", c.id);
      return { connectionId, status: "provisioning", changed: false, note: "metastats enabling" };
    }
    if (Object.keys(regionPatch).length) {
      await sb.from("metaapi_connections").update(regionPatch).eq("id", c.id);
    }
    return { connectionId, status: "provisioning", changed: false, note: `state=${state}` };
  }

  // MetaStats enabled — activate once fully deployed and connected.
  if (state === "DEPLOYED" && connectionStatus === "CONNECTED") {
    await sb
      .from("metaapi_connections")
      .update({ ...regionPatch, status: "active", last_error: null })
      .eq("id", c.id);
    return { connectionId, status: "active", changed: true, note: "activated" };
  }

  if (Object.keys(regionPatch).length) {
    await sb.from("metaapi_connections").update(regionPatch).eq("id", c.id);
  }
  return { connectionId, status: "provisioning", changed: false, note: `state=${state} conn=${connectionStatus}` };
}
