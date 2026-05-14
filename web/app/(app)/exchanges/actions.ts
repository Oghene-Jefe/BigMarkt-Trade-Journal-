"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { connectBybitSchema } from "@/lib/schemas";
import { queryApiKey, BybitApiError, BybitHttpError } from "@/lib/exchanges/bybit/client";
import { validateBybitKey } from "@/lib/exchanges/bybit/permissions";
import { encryptCredential, generateSalt, apiKeyHint } from "@/lib/exchanges/crypto";

export type ConnectActionState = { error?: string; ok?: string };

async function requireUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return { sb, user };
}

export async function connectBybitAction(
  _state: ConnectActionState,
  fd: FormData,
): Promise<ConnectActionState> {
  const { sb, user } = await requireUser();

  // 1. Validate form input. Field names are intentionally non-credential-
  // shaped (x_external_id, x_external_token) so Chrome / Safari Keychain
  // / 1Password / LastPass don't apply their "this is a login form"
  // heuristic and offer to autofill the user's site login credentials.
  // We still accept the legacy "apiKey"/"apiSecret" names as a fallback
  // in case any external caller or test was relying on them.
  const parsed = connectBybitSchema.safeParse({
    label: fd.get("label"),
    environment: fd.get("environment"),
    apiKey: fd.get("x_external_id") ?? fd.get("apiKey"),
    apiSecret: fd.get("x_external_token") ?? fd.get("apiSecret"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your inputs." };
  }
  const { label, environment, apiKey, apiSecret } = parsed.data;

  // 2. Probe Bybit to confirm the credentials work and inspect the key.
  let info;
  try {
    info = await queryApiKey({ apiKey, apiSecret }, environment);
  } catch (e) {
    if (e instanceof BybitApiError) {
      // Surface Bybit's reason verbatim — usually "API key invalid", "Sign
      // mismatch", or "Permission denied". Never the secret.
      return { error: `Bybit rejected the key: ${e.retMsg} (code ${e.retCode})` };
    }
    if (e instanceof BybitHttpError) {
      const reason = e.message.replace(/^Bybit HTTP \d+:\s*/, "");
      if (e.status === 403) {
        return {
          error:
            `Bybit blocked the request with HTTP 403: ${reason}. ` +
            `This usually means Bybit rejected BigMarkt's server IP/region or the key is IP-bound to a different address.`,
        };
      }
      return { error: `Bybit returned HTTP ${e.status}: ${reason}` };
    }
    return {
      error:
        "Could not reach Bybit. Check your API key, secret, and the mainnet/testnet selector.",
    };
  }

  // 3. Reject keys that aren't strictly read-only.
  const validation = validateBybitKey(info);
  if (!validation.ok) return { error: validation.reason };

  // 4. Encrypt credentials with a fresh per-connection salt and store.
  const salt = generateSalt();
  const saltB64 = salt.toString("base64");

  const { error: insertErr } = await sb.from("exchange_connections").insert({
    user_id: user.id,
    exchange: "bybit",
    environment,
    account_label: label,
    encrypted_api_key: encryptCredential(apiKey, user.id, salt),
    encrypted_api_secret: encryptCredential(apiSecret, user.id, salt),
    key_salt: saltB64,
    api_key_hint: apiKeyHint(apiKey),
    external_user_id: info.userID != null ? String(info.userID) : null,
    is_master: info.isMaster ?? null,
    is_uta: info.uta === 1,
    permissions: info.permissions,
    // Bybit reports `["*"]` for keys with no IP restriction (any-IP).
    // A real binding has explicit IP strings. Treat the wildcard as
    // unbound so the UI badge reflects reality.
    ip_bound: info.ips.length > 0 && !(info.ips.length === 1 && info.ips[0] === "*"),
    bound_ips: info.ips.filter((ip) => ip !== "*"),
    status: "active",
  });

  if (insertErr) {
    return { error: `Could not save connection: ${insertErr.message}` };
  }

  revalidatePath("/exchanges");
  redirect("/exchanges");
}
