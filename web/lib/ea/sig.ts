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

// ── shared canonical number renderer ────────────────────────────────────────
// Mirrors DoubleToCanonical() in BigMarkt_EA.mq5 exactly:
//   • non-finite  → "0"
//   • integer     → decimal integer string (no decimal point)
//   • non-integer → toFixed(10) with trailing zeros and trailing decimal stripped
// Never uses exponential notation. Used by BOTH tradeFieldsHash and
// orderFieldsHash so the two hash paths share one renderer.
function eaCanon(v: number): string {
  if (!Number.isFinite(v)) return "0";
  if (Number.isInteger(v)) return String(v);
  let s = v.toFixed(10);
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

// ── canonical trade-fields hash ──────────────────────────────────────────────
// The fields here are the EXACT set in eaTradeSchema. Each is rendered to a
// deterministic string ("" for absent optionals, ISO for strings, numbers via
// eaCanon()). Lines are joined with `\n` and SHA-256 hashed.
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
] as const;

// Fields whose Zod schema default is a numeric zero OR empty string but whose
// canonical hash representation is "" (empty) when absent from the EA payload.
// The EA never sends close_price / close_time for opening deals and always
// emits "" for those slots in ComputeTradeFieldsHash. Zod fills them in as
// 0 / "" after parsing, so we must reverse that default back to "" here to
// keep server and EA canonical strings byte-identical.
// close_time → "" when absent (EA always emits "" for open trades)
// close_price is NOT in this set: EA's DoubleToCanonical(0) returns "0" (integer
// path), so when close_price is absent Zod defaults it to 0 and the server must
// hash it as "0" — not "" — to match the EA's canonical string.
const ABSENT_AS_EMPTY = new Set<string>(["close_time"]);

// Timestamp fields that MUST be passed through verbatim — no new Date(),
// no .toISOString(), no timezone conversion of any kind. The EA hashes the
// raw string it sends; the server must hash that exact same string.
// Any re-serialisation via the JS Date object would shift the value by
// the server's local UTC offset and break the canonical match.
const RAW_STRING_FIELDS = new Set<string>(["open_time", "close_time"]);

function fieldToString(key: string, v: unknown): string {
  if (ABSENT_AS_EMPTY.has(key)) {
    if (v === undefined || v === null || v === 0 || v === "") return "";
  }
  if (v === undefined || v === null) return "";
  if (RAW_STRING_FIELDS.has(key)) {
    return String(v);
  }
  if (typeof v === "number") {
    return eaCanon(v);
  }
  return String(v);
}

/** SHA-256 hex of the canonical trade-field bundle. */
export function tradeFieldsHash(payload: EaTradePayload): string {
  const p = payload as Record<string, unknown>;
  const lines = TRADE_FIELD_ORDER.map(
    (k) => `${k}=${fieldToString(k, p[k])}`,
  );
  const canonical = lines.join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** SHA-256 hex of the canonical order-event field bundle.
 *  Field order MUST match ComputeOrderFieldsHash in BigMarkt_EA.mq5 v2.2.0. */
export function orderFieldsHash(fields: {
  order_ticket: string | number;
  event_type: string;
  symbol: string;      // already uppercased
  type: string;
  lots: number;
  open_price: number;
  sl: number;
  tp: number;
  magic: number;
  comment: string;
}): string {
  const lines = [
    `order_ticket=${String(fields.order_ticket)}`,
    `event_type=${fields.event_type}`,
    `symbol=${fields.symbol}`,
    `type=${fields.type}`,
    `lots=${eaCanon(fields.lots)}`,
    `open_price=${eaCanon(fields.open_price)}`,
    `sl=${eaCanon(fields.sl)}`,
    `tp=${eaCanon(fields.tp)}`,
    `magic=${eaCanon(fields.magic)}`,
    `comment=${fields.comment}`,
  ].join("\n");
  return createHash("sha256").update(lines, "utf8").digest("hex");
}

/** SHA-256 hex of the canonical position_modify field bundle.
 *  Field order MUST match ComputePositionModifyFieldsHash in BigMarkt_EA.mq5
 *  v2.5.0. Recipe (LF-separated, no trailing newline):
 *    event_type=position_modify
 *    position_id=<id>
 *    symbol=<SYMBOL_UPPER>
 *    sl=<canonical>
 *    tp=<canonical>
 *  position_id is rendered verbatim (integer id); sl/tp via eaCanon(); symbol
 *  is already uppercased by the schema. The account_balance/equity/currency
 *  passthrough fields are intentionally NOT part of this hash. */
export function positionModifyFieldsHash(fields: {
  position_id: string | number;
  symbol: string;      // already uppercased
  sl: number;
  tp: number;
}): string {
  const lines = [
    `event_type=position_modify`,
    `position_id=${String(fields.position_id)}`,
    `symbol=${fields.symbol}`,
    `sl=${eaCanon(fields.sl)}`,
    `tp=${eaCanon(fields.tp)}`,
  ].join("\n");
  return createHash("sha256").update(lines, "utf8").digest("hex");
}

// Ascending-numeric comparator for digit-only id strings. ids can exceed 2^53,
// so compare as BigInt (string sort would mis-order ids of different lengths).
function byNumericIdAsc(a: string, b: string): number {
  const ba = BigInt(a);
  const bb = BigInt(b);
  return ba < bb ? -1 : ba > bb ? 1 : 0;
}

/** SHA-256 hex of the canonical open_snapshot field bundle.
 *  Field order MUST match ComputeOpenSnapshotFieldsHash in BigMarkt_EA.mq5
 *  v2.7.1. Recipe (LF-separated, NO trailing newline):
 *    event_type=open_snapshot
 *    position=<id>|<SYM>|<dir>|<lots>|<open>|<sl>|<tp>|<openTimeISO>   (one per position)
 *    pending=<ticket csv>
 *  • <SYM> is the UPPERCASED symbol (the value the schema's .toUpperCase()
 *    produces). <dir> is "buy"/"sell".
 *  • lots/open/sl/tp use eaCanon() — the SAME canonical number renderer as the
 *    other event hashes (integer if whole, else trimmed decimals, never
 *    exponential). open_time is hashed verbatim (raw ISO string, no Date()).
 *  • Positions are re-sorted ascending by numeric position_id (matches the
 *    order the EA already sends), one `position=` line each.
 *  • pending CSV is ascending numeric, comma-joined, no spaces, "" if empty.
 *  The account_balance/equity/currency/backfill passthrough fields are
 *  intentionally NOT part of this hash. */
export function openSnapshotFieldsHash(fields: {
  positions: Array<{
    position_id: string;
    symbol: string;      // already uppercased
    type: "buy" | "sell";
    lots: number;
    open_price: number;
    sl: number;
    tp: number;
    open_time: string;   // raw ISO string ("" allowed)
  }>;
  pending_tickets: string[];
}): string {
  const positionLines = [...fields.positions]
    .sort((a, b) => byNumericIdAsc(a.position_id, b.position_id))
    .map((p) =>
      `position=${p.position_id}|${p.symbol}|${p.type}|${eaCanon(p.lots)}|` +
      `${eaCanon(p.open_price)}|${eaCanon(p.sl)}|${eaCanon(p.tp)}|${p.open_time}`,
    );

  const pendingCsv = [...fields.pending_tickets].sort(byNumericIdAsc).join(",");

  const lines = [
    `event_type=open_snapshot`,
    ...positionLines,
    `pending=${pendingCsv}`,
  ].join("\n");
  return createHash("sha256").update(lines, "utf8").digest("hex");
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

export const NONCE_RE = /^[0-9a-f]{32,64}$/i;
export const SIG_RE = /^[0-9a-f]{64}$/i;
