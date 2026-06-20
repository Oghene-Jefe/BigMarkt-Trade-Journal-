import "server-only";
import type { supabaseServer } from "@/lib/supabase/server";
import type { AccountType } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;

// Minimal shape the active-account primitives need from a broker account.
export type ActiveAccountOption = {
  id: string;
  label: string;
  account_type: AccountType;
  journal_mode: "manual" | "automated";
};

// Column values used when auto-creating a user's first ("Personal") account.
// broker_slug is NOT NULL in broker_accounts (0020) but is free text — 'other'
// is a neutral placeholder the user can edit later. account_number /
// readonly_password are nullable, so we leave them null.
const DEFAULT_ACCOUNT = {
  label: "Personal",
  broker_slug: "other",
  account_type: "live" as AccountType,
  journal_mode: "manual" as const,
  is_active: true,
};

// Ensures the user has at least one broker account. Returns the id of an
// existing account if any, otherwise inserts the default and returns its id.
// Idempotent: safe to call repeatedly.
export async function ensureDefaultAccount(
  supabase: SupabaseServerClient,
  userId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("broker_accounts")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("broker_accounts")
    .insert({ user_id: userId, ...DEFAULT_ACCOUNT })
    .select("id")
    .single();

  if (error || !created) {
    // Lost an insert race (e.g. concurrent request) — re-read.
    const { data: again } = await supabase
      .from("broker_accounts")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (again?.id) return again.id;
    throw error ?? new Error("Failed to create default broker account.");
  }

  return created.id;
}

// Resolves the user's active account. Reads profiles.active_broker_account_id;
// if it's null or no longer one of the user's accounts, falls back to the first
// active account (by created_at). If the user has no accounts at all, creates a
// default one. Persists the resolved id back to profiles and returns it along
// with the full account list.
export async function getActiveAccount(
  supabase: SupabaseServerClient,
  userId: string
): Promise<{ activeId: string; accounts: ActiveAccountOption[] }> {
  const { data: accountRows } = await supabase
    .from("broker_accounts")
    .select("id, label, account_type, journal_mode, is_active, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  let accounts = accountRows ?? [];

  if (accounts.length === 0) {
    await ensureDefaultAccount(supabase, userId);
    const { data: refreshed } = await supabase
      .from("broker_accounts")
      .select("id, label, account_type, journal_mode, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    accounts = refreshed ?? [];
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_broker_account_id")
    .eq("id", userId)
    .maybeSingle();

  const stored = profile?.active_broker_account_id as string | null | undefined;
  const ids = new Set(accounts.map((a) => a.id));

  let activeId: string = stored && ids.has(stored) ? stored : "";
  if (!activeId) {
    const firstActive = accounts.find((a) => a.is_active) ?? accounts[0];
    activeId = firstActive?.id ?? "";
  }

  // Persist the resolved id when it differs from what's stored.
  if (activeId && activeId !== stored) {
    await supabase
      .from("profiles")
      .update({ active_broker_account_id: activeId })
      .eq("id", userId);
  }

  return {
    activeId,
    accounts: accounts.map((a) => ({
      id: a.id,
      label: a.label,
      account_type: a.account_type as AccountType,
      journal_mode: a.journal_mode as "manual" | "automated",
    })),
  };
}
