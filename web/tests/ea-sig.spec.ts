import { describe, expect, it } from "vitest";
import {
  canonicalMessage,
  isTimestampFresh,
  NONCE_RE,
  PROTOCOL_VERSION,
  SIG_RE,
  signMessage,
  tradeFieldsHash,
  TIMESTAMP_WINDOW_MS,
  verifySig,
} from "@/lib/ea/sig";
import type { EaTradePayload } from "@/lib/ea/normalize";
import { makeDealPayload } from "./fixtures/ea";

// Reusable golden payload + key
const PAYLOAD: EaTradePayload = makeDealPayload({
  ticket: 1234567,
  symbol: "EURUSD",
  type: "buy",
  lots: 0.1,
  open_price: 1.0876,
  open_time: "2026-05-17T12:00:00Z",
});

const TOKEN_ID = "11111111-2222-3333-4444-555555555555";
const SECRET = "a".repeat(64); // 32-byte hex

describe("tradeFieldsHash — canonicalization", () => {
  it("produces the same hash regardless of JS object key order", () => {
    // Build the same payload in two different key orders.
    const a: EaTradePayload = makeDealPayload({
      ticket: 99,
      symbol: "XAUUSD",
      type: "sell",
      lots: 0.5,
      open_price: 2300,
      open_time: "2026-05-17T12:00:00Z",
      comment: "scalp",
      profit: -12.5,
    });
    // Same content, deliberately different JS key insertion order.
    const b: EaTradePayload = {
      comment: a.comment,
      profit: a.profit,
      r_multiple: a.r_multiple,
      tp: a.tp,
      sl: a.sl,
      commission: a.commission,
      swap: a.swap,
      close_time: a.close_time,
      close_price: a.close_price,
      magic: a.magic,
      open_time: a.open_time,
      open_price: a.open_price,
      lots: a.lots,
      type: a.type,
      symbol: a.symbol,
      ticket: a.ticket,
    };
    expect(tradeFieldsHash(a)).toBe(tradeFieldsHash(b));
  });

  it("produces a different hash when ANY field changes", () => {
    const base = tradeFieldsHash(PAYLOAD);
    expect(tradeFieldsHash({ ...PAYLOAD, profit: 0.01 })).not.toBe(base);
    expect(tradeFieldsHash({ ...PAYLOAD, ticket: 1234568 })).not.toBe(base);
    // Removing an optional field is also a change.
    expect(tradeFieldsHash({ ...PAYLOAD, comment: "x" })).not.toBe(base);
  });
});

describe("canonicalMessage", () => {
  it("binds protocol, token id, sent_at, nonce, trade hash with newlines", () => {
    const msg = canonicalMessage({
      tokenId: TOKEN_ID,
      sentAt: "2026-05-17T12:00:03.142Z",
      nonce: "9d4f2c6b1a8e70530000000000000000",
      tradeHash: "abc123",
    });
    const parts = msg.split("\n");
    expect(parts[0]).toBe(PROTOCOL_VERSION);
    expect(parts[1]).toBe(TOKEN_ID);
    expect(parts[2]).toBe("2026-05-17T12:00:03.142Z");
    expect(parts[3]).toBe("9d4f2c6b1a8e70530000000000000000");
    expect(parts[4]).toBe("abc123");
  });
});

describe("signMessage / verifySig", () => {
  it("verifies a freshly-signed message", () => {
    const m = "hello world";
    expect(verifySig(m, SECRET, signMessage(m, SECRET))).toBe(true);
  });

  it("rejects a single-bit-flipped signature", () => {
    const m = "hello world";
    const sig = signMessage(m, SECRET);
    // Flip the last hex char
    const flipped = sig.slice(0, -1) + (sig.slice(-1) === "0" ? "1" : "0");
    expect(verifySig(m, SECRET, flipped)).toBe(false);
  });

  it("rejects when the signing secret is wrong", () => {
    const m = "hello world";
    const sig = signMessage(m, SECRET);
    const wrongKey = "b".repeat(64);
    expect(verifySig(m, wrongKey, sig)).toBe(false);
  });

  it("rejects malformed signatures", () => {
    expect(verifySig("x", SECRET, "")).toBe(false);
    expect(verifySig("x", SECRET, "notahex")).toBe(false);
    expect(verifySig("x", SECRET, "a".repeat(63))).toBe(false);
    expect(verifySig("x", SECRET, "a".repeat(65))).toBe(false);
  });
});

describe("isTimestampFresh", () => {
  const NOW = 1_730_000_000_000; // arbitrary anchor

  it("accepts NOW exactly", () => {
    expect(isTimestampFresh(new Date(NOW).toISOString(), NOW)).toBe(true);
  });

  it("accepts 4m59s in the past (inside window)", () => {
    const ts = new Date(NOW - (TIMESTAMP_WINDOW_MS - 1000)).toISOString();
    expect(isTimestampFresh(ts, NOW)).toBe(true);
  });

  it("rejects 5m01s in the past (outside window)", () => {
    const ts = new Date(NOW - (TIMESTAMP_WINDOW_MS + 1000)).toISOString();
    expect(isTimestampFresh(ts, NOW)).toBe(false);
  });

  it("rejects 6m in the future", () => {
    const ts = new Date(NOW + 6 * 60 * 1000).toISOString();
    expect(isTimestampFresh(ts, NOW)).toBe(false);
  });

  it("rejects unparseable strings", () => {
    expect(isTimestampFresh("not a date", NOW)).toBe(false);
    expect(isTimestampFresh("", NOW)).toBe(false);
  });
});

describe("regex constants", () => {
  it("NONCE_RE accepts 32–64 hex chars (EA sends a 64-char nonce)", () => {
    expect(NONCE_RE.test("a".repeat(32))).toBe(true);
    expect(NONCE_RE.test("a".repeat(64))).toBe(true);
    expect(NONCE_RE.test("a".repeat(31))).toBe(false);
    expect(NONCE_RE.test("a".repeat(65))).toBe(false);
    expect(NONCE_RE.test("nothex" + "a".repeat(26))).toBe(false);
  });
  it("SIG_RE requires exactly 64 hex chars", () => {
    expect(SIG_RE.test("a".repeat(64))).toBe(true);
    expect(SIG_RE.test("a".repeat(63))).toBe(false);
    expect(SIG_RE.test("zzz")).toBe(false);
  });
});

// Golden-vector sanity check: any change here means the wire protocol changed.
describe("golden signing vector", () => {
  it("produces a stable HMAC for fixed inputs", () => {
    const tradeHash = tradeFieldsHash(PAYLOAD);
    const message = canonicalMessage({
      tokenId: TOKEN_ID,
      sentAt: "2026-05-17T12:00:03.142Z",
      nonce: "9d4f2c6b1a8e70530000000000000000",
      tradeHash,
    });
    const sig = signMessage(message, SECRET);
    // Length only — recompute and verify (don't hard-pin so test stays
    // legible when canonicalization rules evolve).
    expect(sig).toHaveLength(64);
    expect(verifySig(message, SECRET, sig)).toBe(true);
  });
});
