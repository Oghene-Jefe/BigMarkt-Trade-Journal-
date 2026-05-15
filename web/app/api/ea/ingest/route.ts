import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recalculateAccountScoreWithClient } from "@/lib/scoring-recalculate";
import { buildEaTradeRow, type EaTradePayload } from "@/lib/ea/normalize";

// ── helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
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

  // 3. Parse and validate payload
  let payload: EaTradePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !payload.ticket ||
    !payload.symbol ||
    !payload.type ||
    !payload.lots ||
    !payload.open_price ||
    !payload.open_time
  ) {
    return NextResponse.json(
      { error: "Missing required fields: ticket, symbol, type, lots, open_price, open_time" },
      { status: 400 }
    );
  }

  const brokerAccountId = (tokenRow.broker_account_id as string | null) ?? null;

  // 4. Translate EA field names → trades column names
  const built = buildEaTradeRow({ payload, userId, brokerAccountId });
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const tradeRow = built.row;

  // 5. Save by explicit lookup + insert/update. The database has a partial
  // unique index on (user_id, ticket) where ticket is not null; PostgREST
  // upsert cannot reliably target partial indexes via onConflict.
  const { data: existingTrade, error: lookupError } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", userId)
    .eq("ticket", payload.ticket)
    .maybeSingle();

  if (lookupError) {
    console.error("EA ingest lookup error:", lookupError);
    return NextResponse.json({ error: "Failed to save trade" }, { status: 500 });
  }

  const saveResult = existingTrade?.id
    ? await supabase.from("trades").update(tradeRow).eq("id", existingTrade.id).eq("user_id", userId)
    : await supabase.from("trades").insert(tradeRow);

  if (saveResult.error) {
    console.error("EA ingest save error:", {
      message: saveResult.error.message,
      code: saveResult.error.code,
      details: saveResult.error.details,
      hint: saveResult.error.hint,
    });
    return NextResponse.json({ error: "Failed to save trade" }, { status: 500 });
  }

  // 6. Update last_used_at on the token
  await supabase
    .from("ea_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  // 7. Recalculate account score (best-effort; do not fail ingest on error)
  if (brokerAccountId) {
    const scoreResult = await recalculateAccountScoreWithClient(supabase, userId, brokerAccountId);
    if ("error" in scoreResult) {
      console.error("EA ingest score recalc error:", scoreResult.error);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
