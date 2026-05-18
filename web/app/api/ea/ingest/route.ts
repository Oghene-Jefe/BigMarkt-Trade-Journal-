import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recalculateAccountScoreWithClient } from "@/lib/scoring-recalculate";
import { buildEaTradeRow, eaTradeSchema, type EaTradePayload } from "@/lib/ea/normalize";
import { decryptSigningSecret } from "@/lib/ea/secrets";
import {
  canonicalMessage,
  isTimestampFresh,
  NONCE_RE,
  PROTOCOL_VERSION,
  SIG_RE,
  tradeFieldsHash,
  verifySig,
} from "@/lib/ea/sig";

// ── constants ────────────────────────────────────────────────────────────────

/** Hard cap on request body size. MT5 trades are ~500 bytes; 32 KB is generous. */
const MAX_BODY_BYTES = 32 * 1024;

/** Per-token rate limit: at most this many ingests in the rolling window. */
const TOKEN_RATE_LIMIT = 60;
const TOKEN_RATE_WINDOW_SEC = 60;

/**
 * Per-process in-memory throttle for the v1-deprecation warning log line.
 * Each token id gets one log every DEPRECATION_LOG_INTERVAL_MS; without
 * this a busy EA would spam Vercel logs with the same warning 60×/min.
 * Map entries naturally TTL out by process restart.
 */
const lastDeprecationLogByTokenId = new Map<string, number>();
const DEPRECATION_LOG_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ── helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Read the body with a hard byte cap. Returns null if the body is too large. */
async function readCappedBody(req: NextRequest): Promise<string | null> {
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) return null;

  const reader = req.body?.getReader();
  if (!reader) return "";
  let total = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Is v1 (no X-Ingest-Protocol header) still accepted right now?
 *
 * EA_INGEST_V1_CUTOFF_AT (ISO-8601). If unset → allow v1 with a server
 * warning (per Codex: "do not accidentally brick current users because
 * an env var is missing"). If set and NOW ≥ cutoff → reject v1.
 */
function v1Allowed(): { allowed: true; cutoffMissing: boolean } | { allowed: false } {
  const raw = process.env.EA_INGEST_V1_CUTOFF_AT;
  if (!raw) return { allowed: true, cutoffMissing: true };
  const cutoff = Date.parse(raw);
  if (!Number.isFinite(cutoff)) {
    console.warn("EA_INGEST_V1_CUTOFF_AT is set but unparseable — treating as not set:", raw);
    return { allowed: true, cutoffMissing: true };
  }
  return Date.now() < cutoff
    ? { allowed: true, cutoffMissing: false }
    : { allowed: false };
}

function logV1Deprecation(tokenId: string): void {
  const now = Date.now();
  const last = lastDeprecationLogByTokenId.get(tokenId) ?? 0;
  if (now - last < DEPRECATION_LOG_INTERVAL_MS) return;
  lastDeprecationLogByTokenId.set(tokenId, now);
  console.warn(
    `EA ingest v1 (legacy) request from token_id=${tokenId} — ` +
      `update the MT5 EA to send X-Ingest-Protocol: v2 before EA_INGEST_V1_CUTOFF_AT.`,
  );
}

// ── v2 envelope handling ─────────────────────────────────────────────────────

type V2Envelope = {
  sent_at: string;
  nonce: string;
  sig: string;
};

function readV2Envelope(parsed: unknown): V2Envelope | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj.sent_at !== "string" ||
    typeof obj.nonce !== "string" ||
    typeof obj.sig !== "string"
  ) {
    return null;
  }
  if (!NONCE_RE.test(obj.nonce)) return null;
  if (!SIG_RE.test(obj.sig)) return null;
  return { sent_at: obj.sent_at, nonce: obj.nonce, sig: obj.sig };
}

/**
 * Verify the v2 envelope: shape → timestamp window → signature.
 *
 * Returns NextResponse on failure (the route returns it as-is), or
 * `{ ok: true }` to continue. Nonce-insert happens later in the route,
 * after zod payload validation also passes.
 */
async function validateV2Envelope(args: {
  parsedJson: unknown;
  tradePayload: EaTradePayload;
  tokenId: string;
  userId: string;
  encryptedSecret: {
    ciphertext: string;
    iv: string;
    tag: string;
    keyVersion: number;
  } | null;
}): Promise<{ ok: true; envelope: V2Envelope } | { ok: false; res: NextResponse }> {
  const envelope = readV2Envelope(args.parsedJson);
  if (!envelope) {
    return { ok: false, res: NextResponse.json({ error: "Invalid envelope" }, { status: 400 }) };
  }

  if (!isTimestampFresh(envelope.sent_at)) {
    return { ok: false, res: NextResponse.json({ error: "Stale request" }, { status: 409 }) };
  }

  // Legacy token (pre-0041) → cannot v2-verify.
  if (!args.encryptedSecret) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Invalid signature" }, { status: 401 }),
    };
  }

  let signingSecret: string;
  try {
    signingSecret = decryptSigningSecret(args.encryptedSecret, args.userId, args.tokenId);
  } catch (err) {
    // Tampered ciphertext, wrong master key, wrong row binding. Don't leak
    // which; just refuse.
    console.error("EA ingest signing-secret decrypt failed:", { tokenId: args.tokenId, err });
    return {
      ok: false,
      res: NextResponse.json({ error: "Invalid signature" }, { status: 401 }),
    };
  }

  const tradeHash = tradeFieldsHash(args.tradePayload);
  const message = canonicalMessage({
    tokenId: args.tokenId,
    sentAt: envelope.sent_at,
    nonce: envelope.nonce,
    tradeHash,
  });
  if (!verifySig(message, signingSecret, envelope.sig)) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Invalid signature" }, { status: 401 }),
    };
  }

  return { ok: true, envelope };
}

/**
 * Atomic replay check: INSERT into ea_request_nonces. Duplicate
 * (unique_violation, Postgres code 23505) → replay → 409.
 */
async function recordNonce(
  supabase: SupabaseClient,
  tokenHash: string,
  envelope: V2Envelope,
): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const ins = await supabase
    .from("ea_request_nonces")
    .insert({
      token_hash: tokenHash,
      nonce: envelope.nonce,
      sent_at: envelope.sent_at,
    });
  if (ins.error) {
    // postgrest exposes the underlying Postgres code; 23505 is unique_violation
    // i.e. (token_hash, nonce) already exists.
    if (ins.error.code === "23505") {
      return { ok: false, res: NextResponse.json({ error: "Replayed request" }, { status: 409 }) };
    }
    console.error("EA ingest ea_request_nonces insert failed:", ins.error.message);
    return {
      ok: false,
      res: NextResponse.json({ error: "Ingest temporarily unavailable" }, { status: 503 }),
    };
  }
  return { ok: true };
}

// ── handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  const raw = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const hash = hashToken(raw);

  // 2. Token lookup (now also pulls the encrypted signing-secret blob)
  type TokenRow = {
    id: string;
    user_id: string;
    revoked_at: string | null;
    broker_account_id: string | null;
    signing_secret_ciphertext: string | null;
    signing_secret_iv: string | null;
    signing_secret_tag: string | null;
    signing_secret_key_version: number | null;
  };
  const tokenLookup = await supabase
    .from("ea_tokens")
    .select(
      "id, user_id, revoked_at, broker_account_id, " +
        "signing_secret_ciphertext, signing_secret_iv, signing_secret_tag, " +
        "signing_secret_key_version",
    )
    .eq("token_hash", hash)
    .single();
  const tokenRow = tokenLookup.data as TokenRow | null;

  if (!tokenRow || tokenRow.revoked_at) {
    return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
  }

  const userId = tokenRow.user_id;
  const tokenId = tokenRow.id;
  const brokerAccountId = tokenRow.broker_account_id ?? null;
  const encryptedSecret =
    tokenRow.signing_secret_ciphertext &&
    tokenRow.signing_secret_iv &&
    tokenRow.signing_secret_tag &&
    tokenRow.signing_secret_key_version != null
      ? {
          ciphertext: tokenRow.signing_secret_ciphertext,
          iv: tokenRow.signing_secret_iv,
          tag: tokenRow.signing_secret_tag,
          keyVersion: tokenRow.signing_secret_key_version,
        }
      : null;

  // 3. Protocol version header
  const protocolHeader = req.headers.get("x-ingest-protocol");
  if (protocolHeader && protocolHeader !== PROTOCOL_VERSION) {
    return NextResponse.json({ error: "Unsupported protocol version" }, { status: 400 });
  }
  const isV2 = protocolHeader === PROTOCOL_VERSION;

  // Audit H-3: a token that has been provisioned with a signing secret
  // (i.e. a v2-capable token) MUST NOT accept v1 unsigned requests, no
  // matter what `EA_INGEST_V1_CUTOFF_AT` is set to. The env-driven cutoff
  // is for retiring LEGACY v1-only tokens; it's not a per-token policy.
  // Without this check, an attacker with only the raw bearer (no signing
  // secret) can downgrade the protocol by omitting the v2 header and
  // bypass the entire HMAC + nonce + freshness stack — defeating the
  // whole reason v2 exists.
  if (!isV2 && encryptedSecret) {
    return NextResponse.json(
      {
        error:
          "This token requires the v2 ingest protocol. Update your EA to the latest version.",
      },
      { status: 401 },
    );
  }

  // Cutover check for legacy v1-only tokens (no signing secret on file).
  if (!isV2) {
    const allow = v1Allowed();
    if (!allow.allowed) {
      return NextResponse.json(
        { error: "EA out of date — regenerate your token and update the EA in MT5" },
        { status: 410 },
      );
    }
    if (allow.cutoffMissing) {
      // Don't flood logs from this branch — keep the noisy log to
      // logV1Deprecation() below, gated by token id.
    }
    logV1Deprecation(tokenId);
  }

  // 4. Per-token rate limit (applies to BOTH v1 and v2).
  //
  // Audit H-7: the previous implementation did a SELECT count(*) and a
  // separate INSERT in two round-trips, leaving a TOCTOU race window.
  // Two concurrent requests with the same Bearer could both observe
  // count < limit, both insert, both proceed — the cap was effectively
  // multiplied by the parallelism factor under bursty load.
  //
  // The RPC below (migration 0045) collapses the INSERT + count into a
  // single transactional unit. INSERT happens first to claim a slot;
  // the count read afterward includes the just-written row, so
  // concurrent callers see each other's INSERT before deciding. Cap
  // holds under any parallelism. Rejected requests still consume a
  // slot from the attacker's bucket — sustained burst is correctly
  // rate-limited rather than spiking through.
  const rateRes = await supabase.rpc("ea_ingest_rate_check_and_log", {
    p_token_hash: hash,
    p_limit: TOKEN_RATE_LIMIT,
    p_window_sec: TOKEN_RATE_WINDOW_SEC,
  });
  if (rateRes.error) {
    console.error("EA ingest rate-limit RPC failed:", rateRes.error.message);
    // Fail-CLOSED: a broken rate-limiter must not become an open gate.
    return NextResponse.json({ error: "Ingest temporarily unavailable" }, { status: 503 });
  }
  const newCount = typeof rateRes.data === "number" ? rateRes.data : 0;
  if (newCount > TOKEN_RATE_LIMIT) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // 5. Read body under a 32 KB cap.
  const bodyText = await readCappedBody(req);
  if (bodyText === null) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // 6. Parse JSON
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 7. zod-validate the trade fields. We do this BEFORE v2 sig verify so
  //    the canonical-message computation has a stable, validated payload.
  const parsed = eaTradeSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trade payload" }, { status: 400 });
  }

  // 8. v2 envelope: shape + timestamp + HMAC verify
  let envelopeForReplay: V2Envelope | null = null;
  if (isV2) {
    const env = await validateV2Envelope({
      parsedJson,
      tradePayload: parsed.data,
      tokenId,
      userId,
      encryptedSecret,
    });
    if (!env.ok) return env.res;
    envelopeForReplay = env.envelope;
  }

  // 9. Fetch account type to tag demo trades with trust_badge = 'demo'.
  //    Defence in depth: scope the lookup to the calling user. The bearer
  //    + broker_account_id pair on the token row is already user-owned
  //    (linkEaTokenToAccountAction enforces ownership), but adding
  //    .eq("user_id", userId) here means even a row that somehow slipped
  //    through can't be read across users. If the account is missing or
  //    isn't owned, default to non-demo (auto_verified) and continue —
  //    we don't 401 here because that would leak existence of a specific
  //    broker_account_id.
  let accountType: string | null = null;
  if (brokerAccountId) {
    const { data: account } = await supabase
      .from("broker_accounts")
      .select("account_type")
      .eq("id", brokerAccountId)
      .eq("user_id", userId)
      .maybeSingle();
    accountType = (account?.account_type as string | null) ?? null;
  }

  // 10. Build the canonical DB row
  const built = buildEaTradeRow({ payload: parsed.data, userId, brokerAccountId, accountType });
  if ("error" in built) {
    return NextResponse.json({ error: "Invalid trade payload" }, { status: 400 });
  }
  const tradeRow = built.row;

  // 11. v2 only: insert the nonce LAST — after envelope + payload validation
  //     pass, immediately before the trade write. Atomic; a duplicate is the
  //     replay check.
  if (isV2 && envelopeForReplay) {
    const nonceRes = await recordNonce(supabase, hash, envelopeForReplay);
    if (!nonceRes.ok) return nonceRes.res;
  }

  // 12. Save the trade — explicit lookup + insert/update (existing logic;
  //     trades has a partial unique index on (user_id, ticket)).
  const { data: existingTrade, error: lookupError } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", userId)
    .eq("ticket", parsed.data.ticket)
    .maybeSingle();

  if (lookupError) {
    console.error("EA ingest lookup error:", lookupError);
    return NextResponse.json({ error: "Failed to save trade" }, { status: 500 });
  }

  const saveResult = existingTrade?.id
    ? await supabase.from("trades").update(tradeRow).eq("id", existingTrade.id).eq("user_id", userId)
    : await supabase.from("trades").insert(tradeRow);

  if (saveResult.error) {
    // Audit M-7: previously logged details + hint, which on Postgres
    // unique-constraint violations echoed the conflicting row values
    // (ticket numbers, PnL). Those fields helped ops triage but become
    // a log-exfil risk once Vercel logs are piped to an aggregator.
    // Keep code + message — both stable and non-sensitive — and drop
    // the rest.
    console.error("EA ingest save error:", {
      code: saveResult.error.code,
      message: saveResult.error.message,
    });
    return NextResponse.json({ error: "Failed to save trade" }, { status: 500 });
  }

  // 13. Update last_used_at (best-effort)
  await supabase
    .from("ea_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  // 14. Recalculate account score (best-effort; never fail ingest on error)
  if (brokerAccountId) {
    const scoreResult = await recalculateAccountScoreWithClient(supabase, userId, brokerAccountId);
    if ("error" in scoreResult) {
      console.error("EA ingest score recalc error:", scoreResult.error);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
