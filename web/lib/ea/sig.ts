// Canonical message + HMAC-SHA256 signing for EA ingest v2.
// See docs/ea-replay-protocol.md §3.
//
// Why a fixed field list instead of JSON.stringify:
// JSON.stringify's key order depends on insertion order, and adding a
// new field later would silently change the signature for old payloads.
// By concatenating a FIXED, NAMED set of fields in a documented order,
// we get a stable canonicalization that the MT5 EA can replicate byte-
// for-byte without needing a JSON canonicalizer in MQL5.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { EaTradePayload } from "./normalize";

export const PROTOCOL_VERSION = "v2" as const;

// ── canonical trade-fields hash ──────────────────────────────────────────────
// The fields here are the EXACT set in eaTradeSchema. Each is rendered to a
// deterministic string ("" for absent optionals, ISO for strings, base-10
// for numbers via String()). Lines are joined with `\n` and SHA-256 hashed.
//
// Changing this list is a breaking change to the wire protocol — bump
// PROTOCOL_VERSION (and add a new branch in the route handler) before doing
// so. EA-side code MUST iterate this list in the same order.
const TRADE_FIELD_ORDER = [
  "ticket",
  "symbol",
  "type",
  "lots",
  "open_price",
  "close_price",
  "open_time",
  "close_time",
  "profit",
  "swap",
  "commission",
  "magic",
  "comment",
  "sl",
  "tp",
  "r_multiple",
] as const;

function fieldToString(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") {
    // Number → String uses the shortest round-trip representation in
    // JavaScript (e.g. 1.0876, 0.1). MQL5 must emit the same canonical
    // representation; both languages produce identical output for
    // typical price/lot values within IEEE-754 limits.
    return String(v);
  }
  return String(v);
}

/** SHA-256 hex of the canonical trade-field bundle. */
export function tradeFieldsHash(payload: EaTradePayload): string {
  const lines = TRADE_FIELD_ORDER.map(
    (k) => `${k}=${fieldToString((payload as Record<string, unknown>)[k])}`,
  );
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

// ── canonical signing message ────────────────────────────────────────────────
// Binds: protocol version, token id (NOT the raw bearer), sent_at, nonce,
// and the trade-fields hash. The raw bearer token never appears in the
// signed message — that prevents an attacker who only captures the body
// from learning the bearer.

export function canonicalMessage(args: {
  tokenId: string;
  sentAt: string;
  nonce: string;
  tradeHash: string;
}): string {
  return [
    PROTOCOL_VERSION,
    args.tokenId,
    args.sentAt,
    args.nonce,
    args.tradeHash,
  ].join("\n");
}

// ── HMAC ─────────────────────────────────────────────────────────────────────

export function signMessage(message: string, signingSecretHex: string): string {
  const key = Buffer.from(signingSecretHex, "hex");
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

/**
 * Constant-time compare. Returns false (rather than throws) for any
 * malformed input so callers don't have to wrap in try/catch.
 */
export function verifySig(
  message: string,
  signingSecretHex: string,
  providedSigHex: string,
): boolean {
  if (typeof providedSigHex !== "string" || !/^[0-9a-f]{64}$/i.test(providedSigHex)) {
    return false;
  }
  let expected: Buffer;
  try {
    expected = Buffer.from(
      signMessage(message, signingSecretHex),
      "hex",
    );
  } catch {
    return false;
  }
  const provided = Buffer.from(providedSigHex, "hex");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

// ── envelope validation helpers ──────────────────────────────────────────────

export const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // ±5 min per Codex decision

export function isTimestampFresh(sentAt: string, nowMs: number = Date.now()): boolean {
  const t = Date.parse(sentAt);
  if (!Number.isFinite(t)) return false;
  return Math.abs(nowMs - t) <= TIMESTAMP_WINDOW_MS;
}

export const NONCE_RE = /^[0-9a-f]{32}$/i;
export const SIG_RE = /^[0-9a-f]{64}$/i;
