// Envelope encryption for per-token EA signing secrets.
//
// Mirrors the pattern in web/lib/exchanges/crypto.ts (AES-256-GCM + HKDF)
// but uses a separate master key (EA_SIGNING_SECRET_ENCRYPTION_KEY) so the
// two key custodies are independent. The signing secret never appears in
// the database in plaintext; the master key never appears in the database
// at all — it's read from env at decrypt time.
//
// Schema mapping (ea_tokens columns added in migration 0041):
//   signing_secret_ciphertext  → blob.ct
//   signing_secret_iv          → blob.iv
//   signing_secret_tag         → blob.tag
//   signing_secret_key_version → blob.v
//
// HKDF info is bound to (user_id, token_id) so an attacker who somehow
// gets a single ciphertext + the master key still can't replay it under
// a different token id.

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
const INFO_PREFIX = "bigmarkt-ea-signing-secret|v1|";

/** Current master-key version. Bump if you rotate keys. */
export const CURRENT_KEY_VERSION = 1;

export type EncryptedSigningSecret = {
  ciphertext: string; // base64
  iv: string;         // base64
  tag: string;        // base64
  keyVersion: number;
};

/**
 * Cheap self-check the admin health view can call to confirm
 * EA_SIGNING_SECRET_ENCRYPTION_KEY is configured correctly. Does NOT
 * touch the database. Returns a plain `{ ok, reason }` shape so it can
 * be rendered server-side without leaking the key.
 *
 * Reasons:
 *   - "not_set"       — env var missing
 *   - "not_base64"    — env var present but not valid base64
 *   - "too_short"     — base64 decodes to <32 bytes
 *   - "encrypt_failed" — full round-trip threw
 */
export function checkSigningSecretSetup(): { ok: true } | { ok: false; reason: string } {
  const raw = process.env.EA_SIGNING_SECRET_ENCRYPTION_KEY;
  if (!raw) return { ok: false, reason: "not_set" };
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    return { ok: false, reason: "not_base64" };
  }
  if (buf.length < KEY_BYTES) return { ok: false, reason: "too_short" };
  // Full round-trip with throwaway userId/tokenId, just to exercise the
  // cipher with this exact env value.
  try {
    const blob = encryptSigningSecret("self-check", "_health_", "_health_");
    const back = decryptSigningSecret(blob, "_health_", "_health_");
    if (back !== "self-check") return { ok: false, reason: "encrypt_failed" };
  } catch {
    return { ok: false, reason: "encrypt_failed" };
  }
  return { ok: true };
}

function masterKey(version: number): Buffer {
  // Today we only have one master key. When you rotate, switch on `version`
  // and read from EA_SIGNING_SECRET_ENCRYPTION_KEY_V2 etc.
  if (version !== CURRENT_KEY_VERSION) {
    throw new Error(`ea/secrets: no master key configured for version ${version}`);
  }
  const raw = process.env.EA_SIGNING_SECRET_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "EA_SIGNING_SECRET_ENCRYPTION_KEY is not set. Generate one with " +
        "`openssl rand -base64 32` and add it to your env (Vercel Production + Preview).",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length < KEY_BYTES) {
    throw new Error(
      `EA_SIGNING_SECRET_ENCRYPTION_KEY must decode to ≥${KEY_BYTES} bytes (got ${buf.length}).`,
    );
  }
  return buf.subarray(0, KEY_BYTES);
}

function deriveKey(version: number, userId: string, tokenId: string): Buffer {
  if (!userId) throw new Error("ea/secrets: userId is required");
  if (!tokenId) throw new Error("ea/secrets: tokenId is required");
  const info = Buffer.from(INFO_PREFIX + userId + "|" + tokenId, "utf8");
  // Empty salt is fine here: per-row entropy comes from the random IV
  // and the per-row info binding (userId|tokenId). HKDF without salt
  // is well-defined.
  const derived = hkdfSync("sha256", masterKey(version), Buffer.alloc(0), info, KEY_BYTES);
  return Buffer.from(derived);
}

/** Generate a 32-byte random signing secret, returned as hex. */
export function generateSigningSecret(): string {
  return randomBytes(KEY_BYTES).toString("hex"); // 64 hex chars
}

export function encryptSigningSecret(
  plaintext: string,
  userId: string,
  tokenId: string,
): EncryptedSigningSecret {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptSigningSecret: plaintext must be a non-empty string");
  }
  const key = deriveKey(CURRENT_KEY_VERSION, userId, tokenId);
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

export function decryptSigningSecret(
  blob: EncryptedSigningSecret,
  userId: string,
  tokenId: string,
): string {
  const iv = Buffer.from(blob.iv, "base64");
  const ct = Buffer.from(blob.ciphertext, "base64");
  const tag = Buffer.from(blob.tag, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("decryptSigningSecret: malformed iv/tag");
  }
  const key = deriveKey(blob.keyVersion, userId, tokenId);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  // .final() throws on auth-tag mismatch (tampered ciphertext, wrong
  // key, wrong userId/tokenId, wrong master key).
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
