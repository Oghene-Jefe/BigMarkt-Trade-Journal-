"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

// ── helpers ──────────────────────────────────────────────────────────────────

function generateRawToken(): string {
  return randomBytes(32).toString("hex"); // 64-char hex string
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ── actions ──────────────────────────────────────────────────────────────────

/**
 * Generate a new EA token for the authenticated user.
 * Returns the raw token ONCE — it is never stored and cannot be retrieved again.
 */
export async function generateEaTokenAction(
  label: string
): Promise<{ rawToken: string; id: string } | { error: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  // Enforce a max of 5 active tokens per user
  const { count } = await supabase
    .from("ea_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if ((count ?? 0) >= 5) {
    return { error: "Maximum of 5 active tokens allowed. Revoke one first." };
  }

  const raw = generateRawToken();
  const hash = hashToken(raw);

  const { data, error } = await supabase
    .from("ea_tokens")
    .insert({
      user_id: user.id,
      token_hash: hash,
      label: label.trim().slice(0, 60) || "My EA",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Failed to create token. Please try again." };
  }

  revalidatePath("/ea-setup");
  return { rawToken: raw, id: data.id };
}

/**
 * Revoke an EA token by id. Only the owning user can revoke their own token.
 */
export async function revokeEaTokenAction(
  tokenId: string
): Promise<{ success: true } | { error: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("ea_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("user_id", user.id) // RLS + explicit check
    .is("revoked_at", null); // only revoke if not already revoked

  if (error) {
    return { error: "Failed to revoke token." };
  }

  revalidatePath("/ea-setup");
  return { success: true };
}
