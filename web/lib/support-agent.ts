// Server-side gate for the support desk. The DB function is_support_agent()
// is the single source of truth (support_agents table, plus admins), exactly
// like lib/admin.ts wraps is_admin().
import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export async function supportAgentId(): Promise<string | null> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb.rpc("is_support_agent", { uid: user.id });
  if (error || data !== true) return null;
  return user.id;
}

export async function isSupportAgent(): Promise<boolean> {
  return (await supportAgentId()) !== null;
}

/** Page gate: returns the agent's user id, or redirects away. */
export async function requireSupportAgent(): Promise<string> {
  const id = await supportAgentId();
  if (!id) redirect("/dashboard");
  return id;
}
