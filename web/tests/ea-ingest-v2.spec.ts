// Integration tests for the EA ingest v2 protocol. Exercises the route
// handler with a fully mocked Supabase client so we can assert each
// branch (stale timestamp, replay, bad sig, etc.) without hitting a DB.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { makeDealPayload } from "./fixtures/ea";

// ── env setup ────────────────────────────────────────────────────────────────
beforeAll(() => {
  process.env.EA_SIGNING_SECRET_ENCRYPTION_KEY =
    "MDAwMTAyMDMwNDA1MDYwNzA4MDkwYTBiMGMwZDBlMGYxMDExMTIxMzE0MTUxNjE3MTgxOTFhMWIxYzFkMWUxZg==";
  // Force EA_INGEST_V1_CUTOFF_AT default: unset → v1 allowed
  delete process.env.EA_INGEST_V1_CUTOFF_AT;
});

// ── Supabase mock ────────────────────────────────────────────────────────────
// We need to mock BEFORE importing the route. vi.mock hoists, so the
// factory runs first; we expose a settable `mockState` from the factory
// and re-assign it before each test.

type MockResult = { data?: unknown; error?: { message: string; code?: string } | null; count?: number };

type MockState = {
  // ea_tokens row to return on lookup, or null
  tokenRow:
    | (Record<string, unknown> & { id: string; user_id: string; revoked_at: string | null })
    | null;
  // Post-INSERT count returned by the ea_ingest_rate_check_and_log RPC.
  // (Audit H-7 / migration 0045 collapsed the old SELECT+INSERT pair into
  // a single atomic RPC call. The RPC already includes the just-written
  // row in its count, so setting this to 61 simulates "you just hit the
  // 61st request in the window" and the route returns 429.)
  abuseCount: number;
  // RPC error — fail-CLOSED, route returns 503.
  abuseCountError?: { message: string } | null;
  // Retained for transitional compatibility — no current code path uses it
  // (the old abuse_log.insert was folded into the RPC). Tests can ignore.
  abuseInsertError?: { message: string } | null;
  // ea_request_nonces insert error (e.g. { code: '23505' })
  nonceInsertError?: { message: string; code?: string } | null;
  // trades lookup
  existingTrade: { id: string } | null;
  // trades insert/update error
  tradeSaveError?: { message: string } | null;
  // captured inserts for assertion
  nonceInserts: Array<Record<string, unknown>>;
  tradeOps: Array<{ op: "insert" | "update"; row: Record<string, unknown> }>;
};

const defaultState = (): MockState => ({
  tokenRow: null,
  abuseCount: 0,
  abuseCountError: null,
  abuseInsertError: null,
  nonceInsertError: null,
  existingTrade: null,
  tradeSaveError: null,
  nonceInserts: [],
  tradeOps: [],
});

let mockState: MockState = defaultState();

vi.mock("@/lib/supabase/admin", () => {
  // PostgREST-shaped fluent query stub. Each builder collects predicates
  // and resolves with a hardcoded MockResult based on the table + op.
  function makeBuilder(table: string) {
    let op: "select" | "insert" | "update" = "select";
    let isHeadCount = false;
    const ctx: { eq: Record<string, unknown>; insertRow?: unknown; updateRow?: unknown } = { eq: {} };

    const resolveResult = async (): Promise<MockResult> => {
      if (table === "ea_tokens" && op === "select") {
        if (!mockState.tokenRow) return { data: null, error: { message: "not found" } };
        // honor the .eq("token_hash", ...) lookup
        return { data: mockState.tokenRow, error: null };
      }
      if (table === "ea_tokens" && op === "update") {
        return { data: null, error: null };
      }
      if (table === "abuse_log" && op === "select" && isHeadCount) {
        return mockState.abuseCountError
          ? { error: mockState.abuseCountError, count: 0 }
          : { count: mockState.abuseCount, error: null };
      }
      if (table === "abuse_log" && op === "insert") {
        return { error: mockState.abuseInsertError ?? null };
      }
      if (table === "ea_request_nonces" && op === "insert") {
        if (mockState.nonceInsertError) return { error: mockState.nonceInsertError };
        mockState.nonceInserts.push((ctx.insertRow as Record<string, unknown>) ?? {});
        return { error: null };
      }
      if (table === "trades" && op === "select") {
        return { data: mockState.existingTrade, error: null };
      }
      if (table === "trades" && (op === "insert" || op === "update")) {
        if (mockState.tradeSaveError) return { error: mockState.tradeSaveError };
        mockState.tradeOps.push({
          op,
          row: (op === "insert"
            ? (ctx.insertRow as Record<string, unknown>)
            : (ctx.updateRow as Record<string, unknown>)) ?? {},
        });
        return { error: null };
      }
      return { data: null, error: null };
    };

    const builder = {
      select(_cols: string, opts?: { head?: boolean; count?: string }) {
        op = "select";
        if (opts?.head) isHeadCount = true;
        return builder;
      },
      insert(row: unknown) {
        op = "insert";
        ctx.insertRow = row;
        return builder;
      },
      update(row: unknown) {
        op = "update";
        ctx.updateRow = row;
        return builder;
      },
      eq(col: string, val: unknown) {
        ctx.eq[col] = val;
        return builder;
      },
      gte(_col: string, _val: unknown) { return builder; },
      single() { return resolveResult(); },
      maybeSingle() { return resolveResult(); },
      then(onResolve: (v: MockResult) => unknown, onReject?: (e: unknown) => unknown) {
        // makes the builder awaitable
        return resolveResult().then(onResolve, onReject);
      },
    };
    return builder;
  }

  // Mock the RPC surface used by the route's atomic rate-limit gate
  // (migration 0045 / audit H-7). The real function returns the
  // post-INSERT count for the (token_hash, window) bucket; the route
  // returns 429 when that count exceeds the limit. Our mock returns
  // `abuseCount` (interpreted as the same post-INSERT count) and
  // surfaces `abuseCountError` as a transport failure for the
  // fail-closed 503 path.
  async function rpcFn(
    name: string,
    _params?: Record<string, unknown>,
  ): Promise<MockResult> {
    if (name === "ea_ingest_rate_check_and_log") {
      if (mockState.abuseCountError) {
        return { error: mockState.abuseCountError };
      }
      return { data: mockState.abuseCount, error: null };
    }
    // Any other RPC name returns a benign empty result so unrelated
    // future tests don't blow up unexpectedly.
    return { data: null, error: null };
  }

  return {
    supabaseAdmin: () => ({
      from: (table: string) => makeBuilder(table),
      rpc: rpcFn,
    }),
  };
});

vi.mock("@/lib/scoring-recalculate", () => ({
  recalculateAccountScoreWithClient: vi.fn().mockResolvedValue({ ok: true }),
}));

// ── helpers shared by tests ──────────────────────────────────────────────────
const RAW_BEARER = "a".repeat(64);
const TOKEN_HASH = createHash("sha256").update(RAW_BEARER).digest("hex");
const TOKEN_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "user-1";

// Use the shared fixture so the signed payload carries the same schema
// defaults (close_price, profit, swap, magic, …) the route hashes after
// parsing with eaDealSchema. Omitting them makes the test's canonical
// string diverge from the route's → HMAC mismatch → spurious 401.
// close_time is overridden to "" (input shape) rather than the fixture's
// null (output shape): the request body is re-parsed by eaDealSchema, which
// rejects a null close_time but accepts "" and transforms it to null — and
// both canonicalize to "" so the signature still matches.
const VALID_TRADE = makeDealPayload({ close_time: "" });

async function seedTokenWithSigningSecret(): Promise<{ secret: string }> {
  const { encryptSigningSecret, generateSigningSecret } = await import("@/lib/ea/secrets");
  const secret = generateSigningSecret();
  const blob = encryptSigningSecret(secret, USER_ID, TOKEN_ID);
  mockState.tokenRow = {
    id: TOKEN_ID,
    user_id: USER_ID,
    revoked_at: null,
    broker_account_id: null,
    signing_secret_ciphertext: blob.ciphertext,
    signing_secret_iv: blob.iv,
    signing_secret_tag: blob.tag,
    signing_secret_key_version: blob.keyVersion,
    token_hash: TOKEN_HASH,
  };
  return { secret };
}

function seedLegacyToken() {
  mockState.tokenRow = {
    id: TOKEN_ID,
    user_id: USER_ID,
    revoked_at: null,
    broker_account_id: null,
    signing_secret_ciphertext: null,
    signing_secret_iv: null,
    signing_secret_tag: null,
    signing_secret_key_version: null,
    token_hash: TOKEN_HASH,
  };
}

async function signedBody(opts: {
  trade?: Record<string, unknown>;
  sentAt?: string;
  nonce?: string;
  secret: string;
}) {
  const { tradeFieldsHash, canonicalMessage, signMessage } = await import("@/lib/ea/sig");
  const trade = (opts.trade ?? VALID_TRADE) as Parameters<typeof tradeFieldsHash>[0];
  const sent_at = opts.sentAt ?? new Date().toISOString();
  const nonce = opts.nonce ?? "0123456789abcdef0123456789abcdef";
  const tradeHash = tradeFieldsHash(trade);
  const message = canonicalMessage({ tokenId: TOKEN_ID, sentAt: sent_at, nonce, tradeHash });
  const sig = signMessage(message, opts.secret);
  return { ...trade, sent_at, nonce, sig };
}

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  const init: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${RAW_BEARER}`,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
  return new Request("http://test.local/api/ea/ingest", init);
}

// ── tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockState = defaultState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("EA ingest v2", () => {
  it("accepts a valid v2 request and records the nonce + trade", async () => {
    const { secret } = await seedTokenWithSigningSecret();
    const body = await signedBody({ secret });
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(body, { "x-ingest-protocol": "v2" }) as never);
    expect(res.status).toBe(200);
    expect(mockState.nonceInserts.length).toBe(1);
    expect(mockState.tradeOps.length).toBe(1);
  });

  it("rejects a stale timestamp (+6 min in past)", async () => {
    const { secret } = await seedTokenWithSigningSecret();
    const stale = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const body = await signedBody({ secret, sentAt: stale });
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(body, { "x-ingest-protocol": "v2" }) as never);
    expect(res.status).toBe(409);
    expect(mockState.nonceInserts.length).toBe(0);
    expect(mockState.tradeOps.length).toBe(0);
  });

  it("rejects a future timestamp (+6 min ahead)", async () => {
    const { secret } = await seedTokenWithSigningSecret();
    const future = new Date(Date.now() + 6 * 60 * 1000).toISOString();
    const body = await signedBody({ secret, sentAt: future });
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(body, { "x-ingest-protocol": "v2" }) as never);
    expect(res.status).toBe(409);
  });

  it("clock-skew boundary: 4m59s passes, 5m01s rejects", async () => {
    const { secret } = await seedTokenWithSigningSecret();
    const ok = new Date(Date.now() - (5 * 60 * 1000 - 1000)).toISOString();
    const okBody = await signedBody({ secret, sentAt: ok, nonce: "1".repeat(32) });
    const { POST } = await import("@/app/api/ea/ingest/route");

    const okRes = await POST(makeReq(okBody, { "x-ingest-protocol": "v2" }) as never);
    expect(okRes.status).toBe(200);

    // reset state but keep token mock
    const tokenRow = mockState.tokenRow;
    mockState = defaultState();
    mockState.tokenRow = tokenRow;

    const bad = new Date(Date.now() - (5 * 60 * 1000 + 1000)).toISOString();
    const badBody = await signedBody({ secret, sentAt: bad, nonce: "2".repeat(32) });
    const badRes = await POST(makeReq(badBody, { "x-ingest-protocol": "v2" }) as never);
    expect(badRes.status).toBe(409);
  });

  it("rejects a replayed nonce (mock returns 23505 unique_violation)", async () => {
    const { secret } = await seedTokenWithSigningSecret();
    mockState.nonceInsertError = { message: "duplicate key", code: "23505" };
    const body = await signedBody({ secret });
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(body, { "x-ingest-protocol": "v2" }) as never);
    expect(res.status).toBe(409);
    expect(mockState.tradeOps.length).toBe(0);
  });

  it("rejects a bad signature", async () => {
    const { secret } = await seedTokenWithSigningSecret();
    const body = await signedBody({ secret });
    // Tamper sig — flip last hex char
    body.sig = body.sig.slice(0, -1) + (body.sig.slice(-1) === "0" ? "1" : "0");
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(body, { "x-ingest-protocol": "v2" }) as never);
    expect(res.status).toBe(401);
    expect(mockState.nonceInserts.length).toBe(0);
  });

  it("rejects missing envelope fields", async () => {
    const { secret } = await seedTokenWithSigningSecret();
    const body = await signedBody({ secret });
    // Drop the nonce
    delete (body as Record<string, unknown>).nonce;
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(body, { "x-ingest-protocol": "v2" }) as never);
    expect(res.status).toBe(400);
  });

  it("rejects malformed nonce/sig", async () => {
    const { secret } = await seedTokenWithSigningSecret();
    const body = await signedBody({ secret });
    body.nonce = "not-hex";
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(body, { "x-ingest-protocol": "v2" }) as never);
    expect(res.status).toBe(400);
  });

  it("v2 against a legacy token (NULL signing_secret) → 401", async () => {
    seedLegacyToken();
    // Use placeholder envelope — server should bail BEFORE attempting decrypt.
    const body = {
      ...VALID_TRADE,
      sent_at: new Date().toISOString(),
      nonce: "a".repeat(32),
      sig: "b".repeat(64),
    };
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(body, { "x-ingest-protocol": "v2" }) as never);
    expect(res.status).toBe(401);
  });

  it("v1 before cutoff → 200 plus deprecation log", async () => {
    delete process.env.EA_INGEST_V1_CUTOFF_AT;
    seedLegacyToken();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(VALID_TRADE) as never);
    expect(res.status).toBe(200);
    // Logged once for this token id (the in-memory throttle gates further calls)
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("v1 after cutoff → 410", async () => {
    process.env.EA_INGEST_V1_CUTOFF_AT = new Date(Date.now() - 1000).toISOString();
    seedLegacyToken();
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(VALID_TRADE) as never);
    expect(res.status).toBe(410);
    delete process.env.EA_INGEST_V1_CUTOFF_AT;
  });

  it("rejects an unsupported protocol version header", async () => {
    await seedTokenWithSigningSecret();
    const body = await signedBody({ secret: "a".repeat(64) });
    const { POST } = await import("@/app/api/ea/ingest/route");

    const res = await POST(makeReq(body, { "x-ingest-protocol": "v3" }) as never);
    expect(res.status).toBe(400);
  });
});
