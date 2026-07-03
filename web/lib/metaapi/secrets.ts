// Envelope encryption for per-connection MetaApi READER tokens.
//
// Mirrors web/lib/ea/secrets.ts (AES-256-GCM + HKDF) but with an independent
// master key (METAAPI_TOKEN_ENCRYPTION_KEY) so the EA and MetaApi key custodies
// are separate. The reader token never appears in the database in plaintext;
// the master key never appears in the database at all — read from env at
// encrypt/decrypt time.
//
// We do NOT store the broker investor password anywhere. It is passed to
// MetaApi at provision time and discarded; only the READER-scoped MetaApi token
// (and the MetaApi account id) is persisted, encrypted here.
//
// Unlike ea/secrets.ts there is no generate*() function: we do not mint this
// secret — MetaApi issues the reader token — we only encrypt what it gives us.
//
// Schema mapping (metaapi_connections columns, migration 0083):
//   reader_token_ciphertext   → blob.ciphertext
//   reader_token_iv           → blob.iv
//   reader_token_tag          → blob.tag
//   reader_token_key_version  → blob.keyVersion
//
// HKDF info is bound to (user_id, metaapi_account_id) so an attacker who somehow
// gets a single ciphertext + the master key still can't replay it under a
// different MetaApi account id.

import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm" as const;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const INFO_PREFIX = "bigmarkt-metaapi-reader-token|v1|";

/** Current master-key version. Bump if you rotate keys. */
export const CURRENT_KEY_VERSION = 1;

export type EncryptedReaderToken = {
  ciphertext: string; // base64
  iv: string;         // base64
  tag: string;        // base64
  keyVersion: number;
};

/**
 * Cheap self-check an admin health view can call to confirm
 * METAAPI_TOKEN_ENCRYPTION_KEY is configured correctly. Does NOT touch the
 * database. Returns a plain { ok, reason } shape so it can be rendered
 * server-side without leaking the key.
 *
 * Reasons:
 *   - "not_set"        — env var missing
 *   - "not_base64"     — env var present but not valid base64
 *   - "too_short"      — base64 decodes to <32 bytes
 *   - "encrypt_failed" — full round-trip threw
 */
export function checkReaderTokenSetup(): { ok: true } | { ok: false; reason: string } {
  const raw = process.env.METAAPI_TOKEN_ENCRYPTION_KEY;
  if (!raw) return { ok: false, reason: "not_set" };

  // Node's Buffer.from(_, "base64") is permissive — it silently strips
  // characters outside the base64 alphabet rather than throwing. So do an
  // explicit shape check AND a decode→re-encode round-trip; both must agree
  // (modulo padding) before we accept the value.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
    return { ok: false, reason: "not_base64" };
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    return { ok: false, reason: "not_base64" };
  }
  const reencoded = buf.toString("base64");
  const normalize = (s: string) => s.replace(/=+$/, "");
  if (normalize(reencoded) !== normalize(raw)) {
    return { ok: false, reason: "not_base64" };
  }

  if (buf.length < KEY_BYTES) return { ok: false, reason: "too_short" };

  // Full round-trip with throwaway userId/accountId, just to exercise the
  // cipher with this exact env value.
  try {
    const blob = encryptReaderToken("self-check", "_health_", "_health_");
    const back = decryptReaderToken(blob, "_health_", "_health_");
    if (back !== "self-check") return { ok: false, reason: "encrypt_failed" };
  } catch {
    return { ok: false, reason: "encrypt_failed" };
  }
  return { ok: true };
}

function masterKey(version: number): Buffer {
  // Today we only have one master key. When you rotate, switch on `version`
  // and read from METAAPI_TOKEN_ENCRYPTION_KEY_V2 etc.
  if (version !== CURRENT_KEY_VERSION) {
    throw new Error(`metaapi/secrets: no master key configured for version ${version}`);
  }
  const raw = process.env.METAAPI_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "METAAPI_TOKEN_ENCRYPTION_KEY is not set. Generate one with " +
        "`openssl rand -base64 32` and add it to your env (Vercel Production + Preview).",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length < KEY_BYTES) {
    throw new Error(
      `METAAPI_TOKEN_ENCRYPTION_KEY must decode to ≥${KEY_BYTES} bytes (got ${buf.length}).`,
    );
  }
  return buf.subarray(0, KEY_BYTES);
}

function deriveKey(version: number, userId: string, metaapiAccountId: string): Buffer {
  if (!userId) throw new Error("metaapi/secrets: userId is required");
  if (!metaapiAccountId) throw new Error("metaapi/secrets: metaapiAccountId is required");
  const info = Buffer.from(INFO_PREFIX + userId + "|" + metaapiAccountId, "utf8");
  // Empty salt is fine: per-row entropy comes from the random IV and the
  // per-row info binding (userId|metaapiAccountId). HKDF without salt is
  // well-defined.
  const derived = hkdfSync("sha256", masterKey(version), Buffer.alloc(0), info, KEY_BYTES);
  return Buffer.from(derived);
}

export function encryptReaderToken(
  plaintext: string,
  userId: string,
  metaapiAccountId: string,
): EncryptedReaderToken {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptReaderToken: plaintext must be a non-empty string");
  }
  const key = deriveKey(CURRENT_KEY_VERSION, userId, metaapiAccountId);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_BYTES) throw new Error("unexpected GCM tag length");
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

export function decryptReaderToken(
  blob: EncryptedReaderToken,
  userId: string,
  metaapiAccountId: string,
): string {
  const iv = Buffer.from(blob.iv, "base64");
  const ct = Buffer.from(blob.ciphertext, "base64");
  const tag = Buffer.from(blob.tag, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("decryptReaderToken: malformed iv/tag");
  }
  const key = deriveKey(blob.keyVersion, userId, metaapiAccountId);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  // .final() throws on auth-tag mismatch (tampered ciphertext, wrong key,
  // wrong userId/metaapiAccountId, wrong master key).
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
