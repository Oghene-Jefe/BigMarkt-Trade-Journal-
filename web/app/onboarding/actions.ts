"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import {
  onboardingDisplayNameSchema,
  onboardingUsernameSchema,
  journalMode,
  profileVisibility,
} from "@/lib/schemas";

function slugifyEmailPrefix(prefix: string): string {
  const base = prefix
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return base.length >= 3 ? base : `user-${base || "0"}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function checkUsernameAvailableAction(
  raw: string,
): Promise<{ available: boolean; error?: string }> {
  const parsed = onboardingUsernameSchema.safeParse(raw);
  if (!parsed.success) {
    return { available: false, error: parsed.error.issues[0]?.message ?? "Invalid username" };
  }
  const sb = await supabaseServer();
  const user = await requireUser();
  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .eq("username", parsed.data)
    .neq("id", user.id)
    .maybeSingle();
  if (error) return { available: false, error: "Lookup failed" };
  return { available: !data };
}

export async function saveStep1Action(
  displayNameRaw: string,
  usernameRaw: string,
): Promise<{ ok: true } | { error: string }> {
  const dn = onboardingDisplayNameSchema.safeParse(displayNameRaw);
  if (!dn.success) return { error: "Display name is required (max 80 chars)" };
  const un = onboardingUsernameSchema.safeParse(usernameRaw);
  if (!un.success) return { error: un.error.issues[0]?.message ?? "Invalid username" };

  const user = await requireUser();
  const sb = await supabaseServer();

  // Final uniqueness check (handles race between blur-check and submit)
  const { data: clash } = await sb
    .from("profiles")
    .select("id")
    .eq("username", un.data)
    .neq("id", user.id)
    .maybeSingle();
  if (clash) return { error: "That username is taken" };

  const { error } = await sb
    .from("profiles")
    .update({ display_name: dn.data, username: un.data })
    .eq("id", user.id);
  if (error) return { error: error.message };

  return { ok: true };
}

export async function saveStep2Action(
  mode: string,
): Promise<{ ok: true } | { error: string }> {
  const parsed = journalMode.safeParse(mode);
  if (!parsed.success) return { error: "Invalid journal mode" };

  const user = await requireUser();
  const sb = await supabaseServer();
  const { error } = await sb
    .from("profiles")
    .update({ journal_mode: parsed.data })
    .eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function saveStep3Action(
  visibility: string,
): Promise<{ ok: true } | { error: string }> {
  const parsed = profileVisibility.safeParse(visibility);
  if (!parsed.success) return { error: "Invalid visibility" };

  const user = await requireUser();
  const sb = await supabaseServer();
  const { error } = await sb
    .from("profiles")
    .update({ visibility: parsed.data })
    .eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function skipOnboardingAction(emailPrefix: string): Promise<void> {
  const user = await requireUser();
  const sb = await supabaseServer();

  const baseDisplay = (emailPrefix || "Trader").slice(0, 80);
  const baseUsername = slugifyEmailPrefix(emailPrefix || "user");

  // Try the base username first; on conflict append a random suffix.
  let candidate = baseUsername;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: clash } = await sb
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .neq("id", user.id)
      .maybeSingle();
    if (!clash) break;
    candidate = `${baseUsername.slice(0, 24)}-${randomSuffix()}`;
  }

  await sb
    .from("profiles")
    .update({ display_name: baseDisplay, username: candidate })
    .eq("id", user.id);

  redirect("/dashboard");
}
