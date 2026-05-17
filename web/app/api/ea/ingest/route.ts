import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recalculateAccountScoreWithClient } from "@/lib/scoring-recalculate";
import { buildEaTradeRow, eaTradeSchema } from "@/lib/ea/normalize";

// ── constants ────────────────────────────────────────────────────────────────

/** Hard cap on request body size. MT5 trades are ~500 bytes; 32 KB is generous. */
const MAX_BODY_BYTES = 32 * 1024;

/** Per-token rate limit: at most this many ingests in the rolling window. */
const TOKEN_RATE_LIMIT = 60;
const TOKEN_RATE_WINDOW_SEC = 60;

// ── helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Read the body with a hard byte cap. Returns null if the body is too large. */
async function readCappedBody(req: NextRequest): Promise<string | null> {
  // Fast-path: Content-Length header. EAs always set it.
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
      // Drain & bail out — don't keep allocating.
      try { await reader.cancel(); } catch { /* ignore */ }
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// ── handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Extract bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  const raw = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const hash = hashToken(raw);

  // 2. Look up token — must exist and not be revoked
  const { data: tokenRow } = await supabase
    .from("ea_tokens")
    .select("id, user_id, revoked_at, broker_account_id")
    .eq("token_hash", hash)
    .single();

  if (!tokenRow || tokenRow.revoked_at) {
    return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
  }

  const userId = tokenRow.user_id as string;
  const brokerAccountId = (tokenRow.broker_account_id as string | null) ?? null;

  // 3. Per-token rate limit. abuse_log (migration 0040) is service-role
  //    only. Window = 60s, cap = 60 ingests → 1/sec sustained, with bursts.
  const since = new Date(Date.now() - TOKEN_RATE_WINDOW_SEC * 1000).toISOString();
  const { count: recent } = await supabase
    .from("abuse_log")
    .select("id", { head: true, count: "exact" })
    .eq("scope", "ea_ingest")
    .eq("token_hash", hash)
    .gte("created_at", since);
  if ((recent ?? 0) >= TOKEN_RATE_LIMIT) {
    // Don't leak token-id details in the response.
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  // Log this attempt up front so even a malformed flood gets counted.
  await supabase.from("abuse_log").insert({ scope: "ea_ingest", token_hash: hash });

  // 4. Read body under a 32 KB cap.
  const bodyText = await readCappedBody(req);
  if (bodyText === null) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // 5. Parse + validate. Any zod failure → generic 400 (never echo issues
  //    back — they reveal what shape we accept and ease fuzzing).
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = eaTradeSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trade payload" }, { status: 400 });
  }

  // 6. Translate EA field names → trades column names
  const built = buildEaTradeRow({ payload: parsed.data, userId, brokerAccountId });
  if ("error" in built) {
    return NextResponse.json({ error: "Invalid trade payload" }, { status: 400 });
  }
  const tradeRow = built.row;

  // 7. Save by explicit lookup + insert/update. The trades table has a
  // partial unique index on (user_id, ticket) — PostgREST upsert can't
  // reliably target partial indexes via onConflict.
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
    // Log the full DB error server-side; respond with a generic message so
    // attackers can't enumerate schema/constraint details.
    console.error("EA ingest save error:", {
      message: saveResult.error.message,
      code: saveResult.error.code,
      details: saveResult.error.details,
      hint: saveResult.error.hint,
    });
    return NextResponse.json({ error: "Failed to save trade" }, { status: 500 });
  }

  // 8. Update last_used_at on the token (best-effort, fire-and-forget okay)
  await supabase
    .from("ea_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  // 9. Recalculate account score (best-effort; never fail ingest on error)
  if (brokerAccountId) {
    const scoreResult = await recalculateAccountScoreWithClient(supabase, userId, brokerAccountId);
    if ("error" in scoreResult) {
      console.error("EA ingest score recalc error:", scoreResult.error);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// TODO(security): add replay/timestamp hardening — require EA to include a
// monotonic nonce or signed `sent_at`, reject anything older than ~5 min
// or with a nonce we've seen recently. Today the per-token rate limit
// (60/min) is the only barrier against a captured-token replay flood, and
// idempotent upsert means re-sending the same payload is harmless. The
// MT5 EA change to start signing payloads is tracked separately.
