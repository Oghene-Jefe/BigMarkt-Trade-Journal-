// Server-only credential encryption for exchange API keys.
//
// Design (envelope encryption):
//   master      = base64-decoded EXCHANGE_CREDENTIAL_ENCRYPTION_KEY env var
//   per-row     = generateSalt() — random 32 bytes, stored in
//                 exchange_connections.key_salt as bytea
//   derived key = HKDF-SHA256(master, salt = key_salt,
//                             info = "bigmarkt-exchange-credential|v1|<user_id>",
//                             length = 32)
//   ciphertext  = AES-256-GCM(derived_key, iv = random 12 bytes, plaintext)
//
// Per-row salt + per-user info means even an attacker with the master key
// who steals a single row's ciphertext can't replay derived keys across
// users or rows. The derived key is recomputed on every encrypt/decrypt;
// only the salt and ciphertext blob touch storage.
//
// Threat model:
//   - master env var compromise → full decryption of all rows (acceptable
//     for MVP; documented in EXCHANGE_SECURITY.md)
//   - DB dump only             → useless without master env var
//   - tamper with ciphertext   → AES-GCM auth tag mismatch → throws
//   - tamper with userId       → derived key differs → throws

import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { EncryptedBlob } from "./types";

const ALGORITHM = "aes-256-gcm" as const;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SALT_BYTES = 32;
const INFO_PREFIX = "bigmarkt-exchange-credential|v1|";

function masterKey(): Buffer {
  const raw = process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "EXCHANGE_CREDENTIAL_ENCRYPTION_KEY is not set. Generate one with " +
      "`openssl rand -base64 32` and add it to your env (Vercel Production + Preview).",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length < KEY_BYTES) {
    throw new Error(
      `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY must decode to ≥${KEY_BYTES} bytes (got ${buf.length}).`,
    );
  }
  return buf.subarray(0, KEY_BYTES);
}

function deriveKey(salt: Buffer, userId: string): Buffer {
  if (!userId) throw new Error("deriveKey: userId is required");
  const info = Buffer.from(INFO_PREFIX + userId, "utf8");
  // hkdfSync returns ArrayBuffer in Node ≥18; coerce to Buffer.
  const derived = hkdfSync("sha256", masterKey(), salt, info, KEY_BYTES);
  return Buffer.from(derived);
}

export function generateSalt(): Buffer {
  return randomBytes(SALT_BYTES);
}

export function encryptCredential(
  plaintext: string,
  userId: string,
  salt: Buffer,
): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptCredential: plaintext must be a non-empty string");
  }
  const key = deriveKey(salt, userId);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_BYTES) throw new Error("unexpected GCM tag length");

  const blob: EncryptedBlob = {
    v: 1,
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: tag.toString("base64"),
  };
  return JSON.stringify(blob);
}

export function decryptCredential(
  serialized: string,
  userId: string,
  salt: Buffer,
): string {
  let blob: EncryptedBlob;
  try {
    blob = JSON.parse(serialized) as EncryptedBlob;
  } catch {
    throw new Error("decryptCredential: malformed blob");
  }
  if (blob.v !== 1) throw new Error(`decryptCredential: unsupported blob version ${blob.v}`);

  const iv = Buffer.from(blob.iv, "base64");
  const ct = Buffer.from(blob.ct, "base64");
  const tag = Buffer.from(blob.tag, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("decryptCredential: malformed iv/tag");
  }

  const key = deriveKey(salt, userId);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  // .final() throws if auth tag is wrong, which covers ciphertext tamper,
  // wrong key (wrong userId / salt / master), and malformed input.
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

// Convenience for the api-key-hint UI display: first/last 4 of the plaintext
// API key. Hint is stored unencrypted in the same row so the UI can render
// it without decrypting; never use this for the secret.
export function apiKeyHint(apiKey: string): string {
  if (apiKey.length <= 8) return "****";
  return apiKey.slice(0, 4) + "..." + apiKey.slice(-4);
}

