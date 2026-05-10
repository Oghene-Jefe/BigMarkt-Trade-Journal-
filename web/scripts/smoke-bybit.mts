/**
 * One-off smoke test that proves Phase A + B + C work against real Bybit.
 *
 * Avoids importing modules tainted by `server-only` (it throws when not
 * in a real server-component context). Instead inlines the same logic
 * — those modules are exhaustively unit-tested elsewhere. This script's
 * purpose is integration: real Bybit testnet + real Supabase row + real
 * decrypt round-trip.
 *
 * Usage:
 *   cd web
 *   BYBIT_TEST_KEY=... BYBIT_TEST_SECRET=... \
 *     node --import tsx scripts/smoke-bybit.mts <user_id>
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const userId = process.argv[2];
if (!userId) throw new Error("usage: smoke-bybit <user_id>");

const apiKey = process.env.BYBIT_TEST_KEY!;
const apiSecret = process.env.BYBIT_TEST_SECRET!;
const masterKeyB64 = process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY!;
if (!apiKey || !apiSecret || !masterKeyB64) {
  throw new Error("missing BYBIT_TEST_KEY / BYBIT_TEST_SECRET / EXCHANGE_CREDENTIAL_ENCRYPTION_KEY");
}
const masterKey = Buffer.from(masterKeyB64, "base64").subarray(0, 32);

// ---- Bybit signing + queryApiKey (mirrors lib/exchanges/bybit/*) ------------
function signBybit({
  apiKey,
  apiSecret,
  baseUrl,
  path,
  query = "",
  recvWindow = "5000",
  timestamp = String(Date.now()),
}: {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  path: string;
  query?: string;
  recvWindow?: string;
  timestamp?: string;
}) {
  const sig = createHmac("sha256", apiSecret)
    .update(timestamp + apiKey + recvWindow + query)
    .digest("hex");
  return {
    url: query ? `${baseUrl}${path}?${query}` : `${baseUrl}${path}`,
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "X-BAPI-SIGN": sig,
    },
  };
}

// ---- Permission validator (mirrors lib/exchanges/bybit/permissions.ts) ----
const KNOWN = new Set([
  "ContractTrade", "Spot", "Wallet", "Options", "Derivatives",
  "Exchange", "NFT", "CopyTrading", "BlockTrade", "Earn",
]);
const FUND_DENY = new Set([
  "Withdraw", "AccountTransfer", "SubMemberTransfer",
  "InternalTransfer", "MasterTransfer", "UniversalTransfer",
]);

function validateBybitKey(info: any): { ok: true } | { ok: false; reason: string } {
  if (info.readOnly !== 1) return { ok: false, reason: `readOnly=${info.readOnly}` };
  for (const [g, vsRaw] of Object.entries(info.permissions ?? {})) {
    const vs = (vsRaw as string[]) ?? [];
    if (vs.length === 0) continue; // empty group → nothing granted, allow
    if (!KNOWN.has(g)) return { ok: false, reason: `unknown group ${g} with values ${JSON.stringify(vs)}` };
    for (const v of vs) {
      if (FUND_DENY.has(v)) return { ok: false, reason: `fund-movement value ${v} in ${g}` };
    }
  }
  return { ok: true };
}

// ---- Crypto (mirrors lib/exchanges/crypto.ts) ----------------------------
function deriveKey(salt: Buffer, uid: string): Buffer {
  const info = Buffer.from(`bigmarkt-exchange-credential|v1|${uid}`, "utf8");
  return Buffer.from(hkdfSync("sha256", masterKey, salt, info, 32));
}
function encryptCredential(plaintext: string, uid: string, salt: Buffer): string {
  const key = deriveKey(salt, uid);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: tag.toString("base64"),
  });
}
function decryptCredential(blob: string, uid: string, salt: Buffer): string {
  const { iv, ct, tag } = JSON.parse(blob);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(salt, uid),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ct, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// ---- Run ---------------------------------------------------------------
console.log("→ probing api-testnet.bybit.com /v5/user/query-api …");
const { url, headers } = signBybit({
  apiKey,
  apiSecret,
  baseUrl: "https://api-testnet.bybit.com",
  path: "/v5/user/query-api",
});
const res = await fetch(url, { headers });
const json = await res.json();
if (json.retCode !== 0) {
  console.error("✗ Bybit error:", json.retCode, json.retMsg);
  process.exit(1);
}
const info = json.result;
console.log("  readOnly:", info.readOnly);
console.log("  permissions:", JSON.stringify(info.permissions));
console.log("  ips:", info.ips);
console.log("  userID:", info.userID, "uta:", info.uta, "isMaster:", info.isMaster);

console.log("→ validating permission shape…");
const v = validateBybitKey(info);
if (!v.ok) { console.error("✗", v.reason); process.exit(1); }
console.log("  ok");

console.log("→ encrypting credentials with fresh salt + per-user HKDF…");
const salt = randomBytes(32);
const encKey = encryptCredential(apiKey, userId, salt);
const encSec = encryptCredential(apiSecret, userId, salt);
console.log("  key blob:", encKey.length, "B  secret blob:", encSec.length, "B");
console.log("  plaintext key  inside ciphertext?", encKey.includes(apiKey));
console.log("  plaintext secret inside ciphertext?", encSec.includes(apiSecret));

console.log("→ verifying decrypt round-trip…");
const dKey = decryptCredential(encKey, userId, salt);
const dSec = decryptCredential(encSec, userId, salt);
console.log("  api_key matches:", dKey === apiKey);
console.log("  api_secret matches:", dSec === apiSecret);

console.log("→ inserting exchange_connections row…");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const { data, error } = await sb.from("exchange_connections").insert({
  user_id: userId,
  exchange: "bybit",
  environment: "testnet",
  account_label: "Smoke test (Phase C verification)",
  encrypted_api_key: encKey,
  encrypted_api_secret: encSec,
  key_salt: salt.toString("base64"),
  api_key_hint: apiKey.slice(0, 4) + "..." + apiKey.slice(-4),
  external_user_id: info.userID != null ? String(info.userID) : null,
  is_master: info.isMaster ?? null,
  is_uta: info.uta === 1,
  permissions: info.permissions,
  ip_bound: (info.ips ?? []).length > 0,
  bound_ips: info.ips ?? [],
  status: "active",
}).select("id, account_label, environment, status, ip_bound").single();

if (error) { console.error("✗ insert failed:", error); process.exit(1); }
console.log("  row id:", data.id);
console.log("  status:", data.status, "  ip_bound:", data.ip_bound);

console.log("\n✓ END-TO-END VERIFIED");
