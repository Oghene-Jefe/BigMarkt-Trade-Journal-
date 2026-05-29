import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recalculateAccountScoreWithClient } from "@/lib/scoring-recalculate";
import { buildEaTradeRow, deriveEaResult, eaTradeSchema, type EaTradePayload } from "@/lib/ea/normalize";
import { decryptSigningSecret } from "@/lib/ea/secrets";
import {
  canonicalMessage,
  isTimestampFresh,
  NONCE_RE,
  PROTOCOL_VERSION,
  SIG_RE,
  signMessage,
  tradeFieldsHash,
  verifySig,
} from "@/lib/ea/sig";

// ── debug bypass ────────────────────────────────────────────────────────────
// TODO: Set SKIP_SIG_VERIFY=false in Vercel env after canonical hash fix.
// The open_time timezone mismatch (EA sends broker local time, server
// expects UTC) causes HMAC mismatch when sig verify is enabled.
// Tracked issue: ENTRY_IN open_time → EA uses DEAL_TIME_MSC (fixed in
// mql5/BigMarkt_EA.mq5 v2.1.1) but compiled .ex5 must be recompiled and
// redeployed before sig verify can be re-enabled.
// Do NOT set to false until the new EA is compiled and live.
const SKIP_SIG_VERIFY = process.env.SKIP_SIG_VERIFY === "true";

// ── migration guard ─────────────────────────────────────────────────────────
// Migrations 0021 + 0022 add nine columns to the  table:
//   position_id, deal_entry, close_price, sl, tp, r_multiple, status  (0021)
//   source, verified                                                    (0022)
// Until those migrations are applied to the live DB and MIGRATIONS_APPLIED=true
// is set in Vercel env vars, the position-aware upsert paths are bypassed and
// all inserts fall back to the safe ticket-based path (columns from baseline +
// migration 0018 only). Set MIGRATIONS_APPLIED=true after running the SQL.
const MIGRATIONS_APPLIED = process.env.MIGRATIONS_APPLIED === "true";

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

  // ── Defensive raw-string extraction for timestamp fields ──────────────────
  // Pull open_time/close_time from the raw JSON body before any Zod transform
  // so the hash uses the EXACT bytes the EA sent. This fixes the confirmed 2h
  // shift: whatever was converting T20:17:20Z→T18:17:20Z in the Zod/transform
  // chain is bypassed entirely.
  const rawJson = args.parsedJson as Record<string, unknown>;
  const rawOpenTime: string =
    typeof rawJson.open_time === "string" ? rawJson.open_time
    : typeof args.tradePayload.open_time === "string" ? args.tradePayload.open_time
    : "";
  const rawCloseTime: string =
    typeof rawJson.close_time === "string" ? rawJson.close_time
    : typeof args.tradePayload.close_time === "string" ? args.tradePayload.close_time
    : "";

  // Build a hash-only payload with verbatim timestamp strings.
  const payloadForHash: typeof args.tradePayload = {
    ...args.tradePayload,
    open_time: rawOpenTime || null,
    close_time: rawCloseTime || null,
  };

  const tradeHash = tradeFieldsHash(payloadForHash);
  const message = canonicalMessage({
    tokenId: args.tokenId,
    sentAt: envelope.sent_at,
    nonce: envelope.nonce,
    tradeHash,
  });

  if (!SKIP_SIG_VERIFY) {
    if (!verifySig(message, signingSecret, envelope.sig)) {
      console.error("EA ingest: signature mismatch for token", args.tokenId);
      return {
        ok: false,
        res: NextResponse.json({ error: "Invalid signature" }, { status: 401 }),
      };
    }
  } else {
    console.warn("SKIP_SIG_VERIFY enabled — signature check bypassed");
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
    console.error("EA ingest: invalid trade payload", { tokenId, issues: parsed.error.issues });
    return NextResponse.json(
      { error: 'Invalid trade payload', issues: parsed.error.issues },
      { status: 400 }
    );
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
  const built = buildEaTradeRow({ payload: parsed.data, userId, brokerAccountId, accountType, dealEntry: parsed.data.deal_entry });
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

  // 12. Save the trade — deal_entry-aware upsert logic.
  //
  //   deal_entry === 'in'   → new position opening: upsert by (user_id, position_id)
  //   deal_entry === 'out'  → close an existing position: lookup by position_id and UPDATE
  //   deal_entry absent     → legacy / manual: keep the old ticket-based upsert
  const dealEntry = parsed.data.deal_entry;
  const positionId = parsed.data.position_id ?? null;

  let saveResult: { error: { code: string; message: string } | null };
  let ingestAction: "inserted" | "updated" = "inserted";
  let resultStatus: "open" | "closed" = "closed";

  if (MIGRATIONS_APPLIED && dealEntry === "in" && positionId) {
    // Opening leg — upsert by (user_id, position_id); set status = 'open'.
    // Requires: migration 0021 (position_id column + unique index on user_id,position_id).
    const openRow = {
      ...tradeRow,
      position_id: positionId,
      deal_entry: "in",
      sl: parsed.data.sl || null,
      tp: parsed.data.tp || null,
      status: "open",
      source: 'ea',
      verified: true,
      visibility: 'private',
    };
    // Check if a row already exists for this position
    const { data: existing } = await supabase
      .from('trades')
      .select('id')
      .eq('user_id', userId)
      .eq('position_id', positionId)
      .maybeSingle()

    if (existing) {
      // Row exists — update it
      const { error: updateErr } = await supabase
        .from('trades')
        .update(openRow)
        .eq('id', existing.id)
      saveResult = { error: updateErr ?? null }
      ingestAction = 'updated'
    } else {
      // No row — insert fresh
      const { error: insertErr } = await supabase
        .from('trades')
        .insert(openRow)
      saveResult = { error: insertErr ?? null }
      ingestAction = 'inserted'
    }
    resultStatus = "open";
  } else if (MIGRATIONS_APPLIED && dealEntry === "out" && positionId) {
    // Closing leg — find the open row and UPDATE it with close fields.
    // Requires: migration 0021 (position_id column).
    const { data: openTrade, error: findErr } = await supabase
      .from("trades")
      .select("id")
      .eq("user_id", userId)
      .eq("position_id", positionId)
      .maybeSingle();

    if (findErr) {
      console.error("EA ingest: position lookup error", { tokenId });
      return NextResponse.json({ error: "Failed to save trade" }, { status: 500 });
    }

    if (openTrade?.id) {
      // Happy path: close the existing open row.
      const closeFields = {
        close_price: parsed.data.close_price || null,
        close_time: parsed.data.close_time || null,
        pnl: parsed.data.profit ?? null,
        swap: parsed.data.swap ?? null,
        commission: parsed.data.commission ?? null,
        r_multiple: parsed.data.r_multiple || null,
        result: deriveEaResult(parsed.data.profit),   // set result on close
        deal_entry: "out",
        status: "closed",
        source: 'ea',
        verified: true,
      };
      saveResult = await supabase
        .from("trades")
        .update(closeFields)
        .eq("id", openTrade.id)
        .eq("user_id", userId);
      ingestAction = "updated";
    } else {
      // EA was installed mid-trade — no open row exists; insert a complete closed row.
      const closedRow = {
        ...tradeRow,
        position_id: positionId,
        deal_entry: "out",
        sl: parsed.data.sl || null,
        tp: parsed.data.tp || null,
        r_multiple: parsed.data.r_multiple || null,
        status: "closed",
        source: 'ea',
        verified: true,
      visibility: 'private',
      };
      saveResult = await supabase.from("trades").insert(closedRow);
      ingestAction = "inserted";
    }
    resultStatus = "closed";
  } else {
    // Ticket-based upsert — the safe baseline path used in two cases:
    //   1. MIGRATIONS_APPLIED is not "true": columns from 0021+0022 don't exist
    //      yet; any insert containing them causes Postgres 42703 and a 500.
    //   2. EA payload has no deal_entry / position_id: legacy format.
    //
    // Stopgap note: when migrations are not applied, 'source' and 'verified'
    // are also excluded from the insert since they too require migration 0022.
    // Once migrations are applied + MIGRATIONS_APPLIED=true is set in Vercel,
    // all paths automatically use the full column set.
    if (!MIGRATIONS_APPLIED && (dealEntry || positionId)) {
      console.warn(
        "EA ingest: position-aware path skipped — MIGRATIONS_APPLIED is not set. " +
        "Apply migrations 0021+0022 to your Supabase project and set " +
        "MIGRATIONS_APPLIED=true in Vercel env vars to enable position tracking.",
        { dealEntry, positionId, tokenId },
      );
    }

    const { data: existingTrade, error: lookupError } = await supabase
      .from("trades")
      .select("id")
      .eq("user_id", userId)
      .eq("ticket", parsed.data.ticket)
      .maybeSingle();

    if (lookupError) {
      console.error("EA ingest: trade lookup error", { tokenId });
      return NextResponse.json({ error: "Failed to save trade" }, { status: 500 });
    }

    // Include source+verified only when the columns exist (migration 0022 applied).
    const legacyRow = MIGRATIONS_APPLIED
      ? { ...tradeRow, source: 'ea' as const, verified: true, visibility: 'private' }
      : { ...tradeRow, visibility: 'private' };

    saveResult = existingTrade?.id
      ? await supabase.from("trades").update(legacyRow).eq("id", existingTrade.id).eq("user_id", userId)
      : await supabase.from("trades").insert(legacyRow);
    ingestAction = existingTrade?.id ? "updated" : "inserted";
  }

  if (saveResult.error) {
    console.error("EA ingest: failed to save trade", { tokenId, code: saveResult.error.code });
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
      console.error("EA ingest: score recalc error", { tokenId });
    }
  }

  return NextResponse.json(
    {
      success: true,
      action: ingestAction,
      position_id: positionId,
      status: resultStatus,
    },
    { status: 200 },
  );
}
