import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── types ────────────────────────────────────────────────────────────────────

interface EaTradePayload {
  ticket: number;
  symbol: string;
  type: string;
  lots: number;
  open_price: number;
  close_price?: number;
  open_time: string;
  close_time?: string;
  profit?: number;
  swap?: number;
  commission?: number;
  magic?: number;
  comment?: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function deriveResult(profit?: number, closeTime?: string): string {
  if (!closeTime) return "open";
  if (!profit || profit === 0) return "breakeven";
  return profit > 0 ? "win" : "loss";
}

function deriveDirection(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("buy")) return "long";
  if (t.includes("sell")) return "short";
  return t;
}

// ── handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Extract bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  const raw = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!raw) {
    return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
  }

  const supabase = await createClient();
  const hash = hashToken(raw);

  // 2. Look up token — must exist and not be revoked
  const { data: tokenRow } = await supabase
    .from("ea_tokens")
    .select("id, user_id, revoked_at")
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

  // 4. Translate EA field names → trades column names
  const tradeRow = {
    user_id:          userId,
    ticket:           payload.ticket,
    pair:             payload.symbol,
    direction:        deriveDirection(payload.type),
    lot_size:         payload.lots,
    entry_price:      payload.open_price,
    exit_price:       payload.close_price ?? null,
    open_time:        payload.open_time,
    close_time:       payload.close_time ?? null,
    pnl:              payload.profit ?? null,
    swap:             payload.swap ?? null,
    commission:       payload.commission ?? null,
    magic:            payload.magic ?? null,
    comment:          payload.comment ?? null,
    result:           deriveResult(payload.profit, payload.close_time),
    capture_source:   "ea",
    trust_badge:      "auto_verified",
    core_fields_locked: true,
    auto_approved:    true,
  };

  // 5. Upsert on (user_id, ticket)
  const { error: upsertError } = await supabase
    .from("trades")
    .upsert(tradeRow, { onConflict: "user_id,ticket" });

  if (upsertError) {
    console.error("EA ingest upsert error:", upsertError);
    return NextResponse.json({ error: "Failed to save trade" }, { status: 500 });
  }

  // 6. Update last_used_at on the token
  await supabase
    .from("ea_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
