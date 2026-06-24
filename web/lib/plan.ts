// Server-side helper for Pro entitlement. Mirrors the structure of
// web/lib/admin.ts: the profiles row (columns added in migration 0068)
// is the single source of truth; this just wraps reading it.
//
// IMPORTANT: this module only READS entitlement. As of this commit it is
// wired to nothing — no page or action calls it yet. Gating comes later.
import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export type Plan = "free" | "pro";
export type PlanStatus = "active" | "past_due" | "cancelled" | "comp";

export type UserPlan = {
  plan: Plan;
  plan_status: PlanStatus;
  plan_renews_at: string | null;
  plan_source: string | null;
};

// Safe default for logged-out / no-session callers: treated as a free,
// active account. Never grants Pro by accident.
const DEFAULT_PLAN: UserPlan = {
  plan: "free",
  plan_status: "active",
  plan_renews_at: null,
  plan_source: null,
};

// True only for a 'pro' row that is currently entitled. 'past_due' and
// 'cancelled' lapse the entitlement (grace/lapse = not entitled); 'comp'
// is always entitled. Shared by the current-user and by-user variants.
function entitled(plan: Plan, status: PlanStatus): boolean {
  return plan === "pro" && (status === "active" || status === "comp");
}

/**
 * Plan facts for the current user, read from their own profiles row.
 * RLS already lets a user select their own profile. Returns the safe
 * free/active default when there's no session or the read fails.
 */
export async function getUserPlan(): Promise<UserPlan> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return DEFAULT_PLAN;

  const { data, error } = await sb
    .from("profiles")
    .select("plan, plan_status, plan_renews_at, plan_source")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return DEFAULT_PLAN;

  return {
    plan: (data.plan as Plan) ?? "free",
    plan_status: (data.plan_status as PlanStatus) ?? "active",
    plan_renews_at: (data.plan_renews_at as string | null) ?? null,
    plan_source: (data.plan_source as string | null) ?? null,
  };
}

/**
 * Whether the current user is entitled to Pro.
 * TRUE only when plan === 'pro' AND plan_status IN ('active','comp').
 */
export async function isPro(): Promise<boolean> {
  const { plan, plan_status } = await getUserPlan();
  return entitled(plan, plan_status);
}

/**
 * Page-render variant of the Pro gate. Redirects non-Pro users to
 * /upgrade. That route doesn't exist yet (B2 builds it); referencing it
 * here is harmless — it 404s until then. Mirrors requireAdmin().
 */
export async function requirePro(): Promise<void> {
  if (!(await isPro())) redirect("/upgrade");
}

/**
 * Server-action variant of the Pro gate. Throws instead of redirecting,
 * for the same reason requireAdminForAction() does: a redirect from
 * inside a server action produces a successful-looking response, so a
 * failed Pro-only POST would be indistinguishable from a successful one.
 * Throwing surfaces the failure through Next's server-action error
 * boundary. Page renders should keep using requirePro().
 */
export async function requireProForAction(): Promise<void> {
  if (!(await isPro())) {
    throw new Error("PRO_REQUIRED");
  }
}

/**
 * Entitlement check for a SPECIFIC user by id (for admin views later).
 * Reads that user's profiles row directly. This is only meaningful when
 * called from an already-admin-gated context — it does not itself verify
 * the caller is an admin, and RLS would otherwise prevent reading other
 * users' rows. Returns false on any missing row / read error.
 */
export async function isProForUser(userId: string): Promise<boolean> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("profiles")
    .select("plan, plan_status")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return false;

  return entitled(
    (data.plan as Plan) ?? "free",
    (data.plan_status as PlanStatus) ?? "active",
  );
}
