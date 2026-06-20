"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { createHash, randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  encryptSigningSecret,
  generateSigningSecret,
} from "@/lib/ea/secrets";

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
): Promise<
  | { rawToken: string; signingSecret: string; id: string }
  | { error: string }
> {
  const user = await requireUser();
  const supabase = await createClient();

  // Every token MUST bind to a broker account at creation — an unlinked token
  // captures trades with no account (the footgun this rule removes). Validate
  // the id shape, require it, and confirm the caller owns the account before
  // pointing a token at it.
  const accountId = (broker_account_id ?? "").trim();
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!accountId) {
    return { error: "Select an account before generating a token." };
  }
  if (!uuidRe.test(accountId)) {
    return { error: "Invalid account." };
  }
  const { data: ownedAccount } = await supabase
    .from("broker_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ownedAccount) {
    return { error: "Account not found." };
  }

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

  // Pre-generate the token id so we can bind the signing-secret encryption
  // to it (HKDF info includes the token id). Postgres normally fills this
  // via gen_random_uuid() — we provide it explicitly instead.
  //
  // Audit L-9: was randomBytes(16) formatted with a regex into UUID shape,
  // which produced a non-v4 UUID (no version/variant bits set). Any future
  // client that validates strict v4 would reject it. `crypto.randomUUID()`
  // is v4-conforming and exactly the same call shape.
  const tokenId = randomUUID();

  const signingSecret = generateSigningSecret(); // 64 hex chars, shown once

  let encrypted;
  try {
    encrypted = encryptSigningSecret(signingSecret, user.id, tokenId);
  } catch (err) {
    // Distinguish setup failure (missing/invalid env) from a transient bug
    // so on-call can grep for the marker line. The user-facing message
    // points them to support rather than asking them to retry forever.
    // Never echo env-var names or stack traces to the user.
    console.error(
      "[ea-token-setup] EA_SIGNING_SECRET_ENCRYPTION_KEY is missing or " +
        "invalid — token generation is disabled until ops sets it. Underlying error:",
      err,
    );
    return { error: "EA token setup is temporarily unavailable. Please contact support." };
  }

  const insertPayload: {
    id: string;
    user_id: string;
    token_hash: string;
    label: string;
    signing_secret_ciphertext: string;
    signing_secret_iv: string;
    signing_secret_tag: string;
    signing_secret_key_version: number;
    broker_account_id: string;
  } = {
    id: tokenId,
    user_id: user.id,
    token_hash: hash,
    label: label.trim().slice(0, 60) || "My EA",
    signing_secret_ciphertext: encrypted.ciphertext,
    signing_secret_iv: encrypted.iv,
    signing_secret_tag: encrypted.tag,
    signing_secret_key_version: encrypted.keyVersion,
    broker_account_id: accountId,
  };

  const { data, error } = await supabase
    .from("ea_tokens")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !data) {
    console.error("generateEaTokenAction insert failed:", error);
    return { error: "Failed to create token. Please try again." };
  }

  revalidatePath("/ea-setup");
  return { rawToken: raw, signingSecret, id: data.id };
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

  // Ownership guard: if linking (not unlinking), confirm the caller actually
  // owns the broker_account before pointing a token at it. RLS on
  // broker_accounts would also block a cross-user select, but this gives
  // a precise error and prevents Daisy from linking her token to Bob's
  // account via a hand-crafted POST.
  if (accountIdRaw) {
    const { data: account } = await supabase
      .from("broker_accounts")
      .select("id")
      .eq("id", accountIdRaw)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!account) return { error: "Account not found" };
  }

  const { error } = await supabase
    .from("ea_tokens")
    .update({ broker_account_id: accountIdRaw || null })
    .eq("id", tokenId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to link token to account." };

  revalidatePath("/ea-setup");
}
