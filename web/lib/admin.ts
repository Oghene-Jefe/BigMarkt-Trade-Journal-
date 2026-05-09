// Server-side helper for the admin gate. The DB function is_admin() is
// the single source of truth; this just wraps the RPC call.
import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export async function isAdmin(): Promise<boolean> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  // is_admin(uid) is granted to authenticated and reads admin_users via
  // SECURITY DEFINER, so this returns true/false without exposing the table.
  const { data, error } = await sb.rpc("is_admin", { uid: user.id });
  if (error) return false;
  return data === true;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/dashboard");
}
