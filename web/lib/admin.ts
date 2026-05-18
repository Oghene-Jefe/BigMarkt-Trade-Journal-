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

/**
 * Server-action variant of the admin gate.
 *
 * Throws when the caller isn't an admin instead of redirecting. The
 * difference matters: a redirect from inside a server action produces
 * a successful-looking response (the Next.js runtime swallows the
 * NEXT_REDIRECT), which makes failed admin-only POSTs indistinguishable
 * from successful ones at the UI layer. Throwing surfaces the failure
 * through Next's server-action error boundary so the calling form
 * shows an error instead of silently succeeding.
 *
 * Audit M-12. The original `if (!(await isAdmin())) return;` pattern
 * in web/app/(app)/admin/actions.ts was the same problem with an
 * uglier failure mode — silent void return, the form looks like it
 * worked.
 *
 * Page renders should keep using `requireAdmin()` — a server-side
 * redirect is the correct UX there.
 */
export async function requireAdminForAction(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("FORBIDDEN: admin access required");
  }
}
