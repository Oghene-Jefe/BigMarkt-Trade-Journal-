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
  label: string,
  broker_account_id?: string
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

  const insertPayload: {
    user_id: string;
    token_hash: string;
    label: string;
    broker_account_id?: string;
  } = {
    user_id: user.id,
    token_hash: hash,
    label: label.trim().slice(0, 60) || "My EA",
  };
  if (broker_account_id) insertPayload.broker_account_id = broker_account_id;

  const { data, error } = await supabase
    .from("ea_tokens")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Failed to create token. Please try again." };
  }

  revalidatePath("/ea-setup");
  return { rawToken: raw, id: data.id };
}

export type EaConnectionLogEntry = {
  id: number;
  token_id: string;
  event: "connected" | "disconnected";
  ip: string | null;
  created_at: string;
  label: string;
};

/**
 * Fetch the most recent 20 EA WebSocket connect/disconnect events for the
 * current user, joined with the token label.
 */
export async function getEaConnectionLogAction(): Promise<EaConnectionLogEntry[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ea_connection_log")
    .select("id, token_id, event, ip, created_at, ea_tokens(label)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.map((row: {
    id: number;
    token_id: string;
    event: "connected" | "disconnected";
    ip: string | null;
    created_at: string;
    ea_tokens: { label: string } | { label: string }[] | null;
  }) => {
    const tokenJoin = Array.isArray(row.ea_tokens) ? row.ea_tokens[0] : row.ea_tokens;
    return {
      id: row.id,
      token_id: row.token_id,
      event: row.event,
      ip: row.ip,
      created_at: row.created_at,
      label: tokenJoin?.label ?? "Unknown",
    };
  });
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

/**
 * Link an existing EA token to a broker account (or clear the link).
 * Pass an empty string for broker_account_id to unlink.
 */
export async function linkEaTokenToAccountAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const user = await requireUser();
  const supabase = await createClient();

  const tokenId = String(formData.get("token_id") ?? "").trim();
  const accountIdRaw = String(formData.get("broker_account_id") ?? "").trim();

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(tokenId)) return { error: "Invalid token id" };
  if (accountIdRaw && !uuidRe.test(accountIdRaw)) return { error: "Invalid account id" };

  const { error } = await supabase
    .from("ea_tokens")
    .update({ broker_account_id: accountIdRaw || null })
    .eq("id", tokenId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to link token to account." };

  revalidatePath("/ea-setup");
}
