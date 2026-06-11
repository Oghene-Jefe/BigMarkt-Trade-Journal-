import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recalculateAccountScoreWithClient } from "@/lib/scoring-recalculate";
import {
  buildEaTradeRow,
  deriveEaDirection,
  deriveEaResult,
  eaDealSchema,
  eaOrderSchema,
  type EaDealPayload,
  type EaOrderPayload,
} from "@/lib/ea/normalize";
import { decryptSigningSecret } from "@/lib/ea/secrets";
import {
  canonicalMessage,
  isTimestampFresh,
  NONCE_RE,
  orderFieldsHash,
  PROTOCOL_VERSION,
  SIG_RE,
  tradeFieldsHash,
  verifySig,
} from "@/lib/ea/sig";

// ── debug bypass ────────────────────────────────────────────────────────────
// TODO: Set SKIP_SIG_VERIFY=false after EA v2.2.0 is compiled and confirmed live.
const SKIP_SIG_VERIFY = process.env.SKIP_SIG_VERIFY === "true";

// MIGRATIONS_APPLIED is always true in prod (0021+0022+0052+0054 all applied).
// Keep the guard for local dev environments that haven't run migrations yet.
const MIGRATIONS_APPLIED = process.env.MIGRATIONS_APPLIED === "true";

// ── constants ────────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 32 * 1024;
const TOKEN_RATE_LIMIT = 60;
const TOKEN_RATE_WINDOW_SEC = 60;

const lastDeprecationLogByTokenId = new Map<string, number>();
const DEPRECATION_LOG_INTERVAL_MS = 60 * 60 * 1000;

// ── helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

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

function v1Allowed(): { allowed: true; cutoffMissing: boolean } | { allowed: false } {
  const raw = process.env.EA_INGEST_V1_CUTOFF_AT;
  if (!raw) return { allowed: true, cutoffMissing: true };
  const cutoff = Date.parse(raw);
  if (!Number.isFinite(cutoff)) {
    console.warn("EA_INGEST_V1_CUTOFF_AT is set but unparseable — treating as not set:", raw);
    return { allowed: true, cutoffMissing: true };
  }
  return Date.now() < cutoff ? { allowed: true, cutoffMissing: false } : { allowed: false };
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

// ── trade_events helper ───────────────────────────────────────────────────────

// Wraps every trade_events insert in try/catch so it can NEVER throw into the
// request path.  A failed event log is silent — the ingest still returns 200.
async function logEvent(
  supabase: SupabaseClient,
  event: {
    trade_id?: string | null;
    user_id: string;
    position_id?: string | null;
    order_ticket?: string | null;
    event_type: string;
    price?: number | null;
    sl?: number | null;
    tp?: number | null;
    lots?: number | null;
    pnl?: number | null;
    event_time?: string | null;
    raw?: Record<string, unknown>;
  },
) {
  try {
    await supabase.from("trade_events").insert({
      trade_id:     event.trade_id ?? null,
      user_id:      event.user_id,
      position_id:  event.position_id ?? null,
      order_ticket: event.order_ticket ?? null,
      event_type:   event.event_type,
      price:        event.price ?? null,
      sl:           event.sl ?? null,
      tp:           event.tp ?? null,
      lots:         event.lots ?? null,
      pnl:          event.pnl ?? null,
      event_time:   event.event_time ?? null,
      raw:          event.raw ?? null,
    });
  } catch (err) {
    console.error("EA ingest: trade_events log failed (non-fatal)", { event_type: event.event_type, err });
  }
}

// ── v2 envelope ───────────────────────────────────────────────────────────────

type V2Envelope = { sent_at: string; nonce: string; sig: string };

function readV2Envelope(parsed: unknown): V2Envelope | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj.sent_at !== "string" ||
    typeof obj.nonce !== "string" ||
    typeof obj.sig !== "string"
  ) return null;
  if (!NONCE_RE.test(obj.nonce)) return null;
  if (!SIG_RE.test(obj.sig)) return null;
  return { sent_at: obj.sent_at, nonce: obj.nonce, sig: obj.sig };
}

async function validateV2Envelope(args: {
  parsedJson: unknown;
  isOrderEvent: boolean;
  orderPayload?: EaOrderPayload;
  dealPayload?: EaDealPayload;
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
  if (!args.encryptedSecret) {
    return { ok: false, res: NextResponse.json({ error: "Invalid signature" }, { status: 401 }) };
  }

  let signingSecret: string;
  try {
    signingSecret = decryptSigningSecret(args.encryptedSecret, args.userId, args.tokenId);
  } catch (err) {
    console.error("EA ingest signing-secret decrypt failed:", { tokenId: args.tokenId, err });
    return { ok: false, res: NextResponse.json({ error: "Invalid signature" }, { status: 401 }) };
  }

  const rawJson = args.parsedJson as Record<string, unknown>;

  let serverHash: string;
  if (args.isOrderEvent && args.orderPayload) {
    serverHash = orderFieldsHash({
      order_ticket: args.orderPayload.order_ticket,
      event_type:   args.orderPayload.event_type,
      symbol:       args.orderPayload.symbol,
      type:         args.orderPayload.type,
      lots:         args.orderPayload.lots,
      open_price:   args.orderPayload.open_price,
      sl:           args.orderPayload.sl,
      tp:           args.orderPayload.tp,
      magic:        args.orderPayload.magic,
      comment:      args.orderPayload.comment,
    });
  } else if (args.dealPayload) {
    const rawOpenTime: string =
      typeof rawJson.open_time === "string" ? rawJson.open_time
      : typeof args.dealPayload.open_time === "string" ? args.dealPayload.open_time
      : "";
    const rawCloseTime: string =
      typeof rawJson.close_time === "string" ? rawJson.close_time
      : typeof args.dealPayload.close_time === "string" ? args.dealPayload.close_time
      : "";
    const payloadForHash = { ...args.dealPayload, open_time: rawOpenTime || null, close_time: rawCloseTime || null };
    serverHash = tradeFieldsHash(payloadForHash);
  } else {
    return { ok: false, res: NextResponse.json({ error: "Invalid envelope" }, { status: 400 }) };
  }

  const eaFieldHash =
    typeof rawJson.field_hash === "string" && /^[0-9a-f]{64}$/i.test(rawJson.field_hash)
      ? rawJson.field_hash.toLowerCase() : null;

  const hashForSig = eaFieldHash ?? serverHash;
  const message = canonicalMessage({
    tokenId: args.tokenId,
    sentAt: envelope.sent_at,
    nonce: envelope.nonce,
    tradeHash: hashForSig,
  });

  if (!SKIP_SIG_VERIFY) {
    if (!verifySig(message, signingSecret, envelope.sig)) {
      console.error("EA ingest: signature mismatch for token", args.tokenId);
      return { ok: false, res: NextResponse.json({ error: "Invalid signature" }, { status: 401 }) };
    }
  } else {
    console.warn("SKIP_SIG_VERIFY enabled — signature check bypassed");
  }

  if (eaFieldHash && eaFieldHash !== serverHash) {
    console.warn("EA ingest hash parity miss", { tokenId: args.tokenId, eaFieldHash, serverHash });
  }

  return { ok: true, envelope };
}

async function recordNonce(
  supabase: SupabaseClient,
  tokenHash: string,
  envelope: V2Envelope,
): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const ins = await supabase.from("ea_request_nonces").insert({
    token_hash: tokenHash,
    nonce: envelope.nonce,
    sent_at: envelope.sent_at,
  });
  if (ins.error) {
    if (ins.error.code === "23505") {
      return { ok: false, res: NextResponse.json({ error: "Replayed request" }, { status: 409 }) };
    }
    console.error("EA ingest ea_request_nonces insert failed:", ins.error.message);
    return { ok: false, res: NextResponse.json({ error: "Ingest temporarily unavailable" }, { status: 503 }) };
  }
  return { ok: true };
}

// ── order event handler ───────────────────────────────────────────────────────

async function handleOrderEvent(
  supabase: SupabaseClient,
  payload: EaOrderPayload,
  userId: string,
  tokenId: string,
  brokerAccountId: string | null,
  accountType: string | null,
): Promise<NextResponse> {
  const { event_type, order_ticket, symbol, type: orderType } = payload;

  const trustBadge =
    accountType === "prop_firm" ? "prop_firm"
    : accountType === "demo"    ? "demo"
    : "auto_verified";

  const direction = deriveEaDirection(orderType);
  if (!direction) {
    return NextResponse.json({ error: "Invalid trade type" }, { status: 400 });
  }

  // Fix 1: ignore market-order transient events.
  // MT5 fires ORDER_ADD/UPDATE/DELETE for instant market executions (type='buy'
  // or 'sell') as well as pending orders. Market-order events are transient
  // housekeeping — the deal handler creates the position row from the
  // accompanying ENTRY_IN deal. Writing a pending row here would create a
  // phantom that never gets merged and pollutes the journal.
  // Pending order types always contain 'limit' or 'stop' in their type string
  // (buy_limit, sell_limit, buy_stop, sell_stop, buy_stop_limit, sell_stop_limit).
  const isPendingOrderType = /limit|stop/i.test(orderType);
  if (!isPendingOrderType) {
    return NextResponse.json({ success: true, ignored: "market_order_event" }, { status: 200 });
  }

  // ── order_add ──────────────────────────────────────────────────────────────
  if (event_type === "order_add") {
    // UPSERT on (user_id, order_ticket) so a retried order_add is idempotent.
    // idx_trades_user_ticket covers (user_id, ticket) but order_ticket is a
    // TEXT column with only a non-unique index — we do a manual check+insert.
    const { data: existing } = await supabase
      .from("trades")
      .select("id")
      .eq("user_id", userId)
      .eq("order_ticket", order_ticket)
      .maybeSingle();

    const orderRow: Record<string, unknown> = {
      user_id:      userId,
      pair:         symbol,
      direction,
      lot_size:     payload.lots || null,
      entry_price:  payload.open_price || null,
      stop_loss:    payload.sl ? payload.sl : null,
      take_profit:  payload.tp ? payload.tp : null,
      open_time:    payload.order_time ?? null,
      magic:        payload.magic || null,
      comment:      payload.comment || null,
      order_ticket,
      event_type:   "order_add",
      order_status: "pending",
      status:       "pending",
      source:       "ea",
      verified:     true,
      visibility:   "private",
      capture_source: "ea",
      trust_badge:  trustBadge,
      result:       null,
    };
    if (brokerAccountId) orderRow.broker_account_id = brokerAccountId;

    let tradeId: string | null = null;
    if (existing?.id) {
      // Idempotent re-delivery — update the existing pending row.
      await supabase
        .from("trades")
        .update({ ...orderRow, event_type: "order_add" })
        .eq("id", existing.id);
      tradeId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("trades")
        .insert(orderRow)
        .select("id")
        .single();
      if (insertErr) {
        console.error("EA ingest: order_add insert failed", { tokenId, code: insertErr.code, message: insertErr.message, details: insertErr.details, hint: insertErr.hint });
        return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
      }
      tradeId = inserted?.id ?? null;
    }

    await logEvent(supabase, {
      trade_id:     tradeId,
      user_id:      userId,
      order_ticket,
      event_type:   "pending_set",
      price:        payload.open_price || null,
      sl:           payload.sl || null,
      tp:           payload.tp || null,
      lots:         payload.lots || null,
      event_time:   payload.order_time ?? null,
      raw:          { order_type: orderType, symbol },
    });

    return NextResponse.json({ success: true, action: existing ? "updated" : "inserted", event_type }, { status: 200 });
  }

  // ── order_update ───────────────────────────────────────────────────────────
  if (event_type === "order_update") {
    const { data: existing } = await supabase
      .from("trades")
      .select("id")
      .eq("user_id", userId)
      .eq("order_ticket", order_ticket)
      .maybeSingle();

    let tradeId: string | null = existing?.id ?? null;

    if (existing?.id) {
      await supabase
        .from("trades")
        .update({
          entry_price:  payload.open_price || null,
          stop_loss:    payload.sl ? payload.sl : null,
          take_profit:  payload.tp ? payload.tp : null,
          order_status: "modified",
          event_type:   "order_update",
        })
        .eq("id", existing.id)
        .eq("user_id", userId);
    } else {
      // Order update arrived before order_add — create the pending row.
      const orderRow: Record<string, unknown> = {
        user_id:      userId,
        pair:         symbol,
        direction,
        lot_size:     payload.lots || null,
        entry_price:  payload.open_price || null,
        stop_loss:    payload.sl ? payload.sl : null,
        take_profit:  payload.tp ? payload.tp : null,
        open_time:    payload.order_time ?? null,
        order_ticket,
        event_type:   "order_update",
        order_status: "modified",
        status:       "pending",
        source:       "ea",
        verified:     true,
        visibility:   "private",
        capture_source: "ea",
        trust_badge:  trustBadge,
        result:       null,
      };
      if (brokerAccountId) orderRow.broker_account_id = brokerAccountId;
      const { data: inserted } = await supabase.from("trades").insert(orderRow).select("id").single();
      tradeId = inserted?.id ?? null;
    }

    await logEvent(supabase, {
      trade_id:     tradeId,
      user_id:      userId,
      order_ticket,
      event_type:   "pending_modified",
      price:        payload.open_price || null,
      sl:           payload.sl || null,
      tp:           payload.tp || null,
      event_time:   payload.order_time ?? null,
      raw:          { order_type: orderType, symbol },
    });

    return NextResponse.json({ success: true, action: "updated", event_type }, { status: 200 });
  }

  // ── order_delete ───────────────────────────────────────────────────────────
  if (event_type === "order_delete") {
    const { data: existing } = await supabase
      .from("trades")
      .select("id, status")
      .eq("user_id", userId)
      .eq("order_ticket", order_ticket)
      .maybeSingle();

    if (existing?.id) {
      const rowStatus = (existing as { id: string; status?: string | null }).status;
      if (rowStatus === "pending") {
        // True cancellation — the order left the book without filling.
        await supabase
          .from("trades")
          .update({ order_status: "cancelled", status: "cancelled", event_type: "order_delete" })
          .eq("id", existing.id)
          .eq("user_id", userId);

        await logEvent(supabase, {
          trade_id:     existing.id,
          user_id:      userId,
          order_ticket,
          event_type:   "pending_cancelled",
          event_time:   payload.order_time ?? null,
          raw:          { order_type: orderType, symbol },
        });
      }
      // If status='open' the order filled and this delete is MT5 removing it from
      // the pending book — skip, the fill already transitioned the row.
    }

    return NextResponse.json({ success: true, action: "updated", event_type }, { status: 200 });
  }

  // Unknown event_type — ignored silently.
  return NextResponse.json({ success: true, action: "ignored", event_type }, { status: 200 });
}

// ── deal event handler ────────────────────────────────────────────────────────

async function handleDealEvent(
  supabase: SupabaseClient,
  payload: EaDealPayload,
  userId: string,
  tokenId: string,
  brokerAccountId: string | null,
  accountType: string | null,
): Promise<{ res: NextResponse; action: string; positionId: string | null; resultStatus: "open" | "closed" }> {
  const dealEntry  = payload.deal_entry;
  const positionId = payload.position_id ?? null;

  let action: "inserted" | "updated" = "inserted";
  let resultStatus: "open" | "closed" = "closed";

  // ── ENTRY_IN ───────────────────────────────────────────────────────────────
  if (MIGRATIONS_APPLIED && dealEntry === "in" && positionId) {
    // Step 1: look for a pending-order row to merge into.
    // MT5 linkage: the deal's order_ticket is the order that got filled.
    // The pending row was keyed by order_ticket.
    const dealOrderTicket = payload.order_ticket ?? null;
    let mergedFromPending = false;
    let tradeId: string | null = null;

    if (dealOrderTicket) {
      const { data: pendingRow } = await supabase
        .from("trades")
        .select("id, status")
        .eq("user_id", userId)
        .eq("order_ticket", dealOrderTicket)
        .in("status", ["pending", "cancelled"])
        .maybeSingle();

      if (pendingRow?.id) {
        // Flip the pending row to open.
        const { error: mergeErr } = await supabase
          .from("trades")
          .update({
            position_id:  positionId,
            ticket:       payload.ticket,
            entry_price:  payload.open_price,
            open_time:    payload.open_time || null,
            lot_size:     payload.lots,
            stop_loss:    payload.sl ? payload.sl : null,
            take_profit:  payload.tp ? payload.tp : null,
            sl:           payload.sl || null,
            tp:           payload.tp || null,
            direction:    deriveEaDirection(payload.type) ?? undefined,
            pair:         payload.symbol,
            deal_entry:   "in",
            order_status: "filled",
            status:       "open",
            result:       null,
          })
          .eq("id", pendingRow.id)
          .eq("user_id", userId);

        if (mergeErr) {
          console.error("EA ingest: pending→open merge failed", { tokenId, code: mergeErr.code, message: mergeErr.message, details: mergeErr.details, hint: mergeErr.hint });
        } else {
          mergedFromPending = true;
          tradeId = pendingRow.id;
          action = "updated";
        }
      }
    }

    if (!mergedFromPending) {
      // No pending row — UPSERT a fresh open row on (user_id, position_id).
      const built = buildEaTradeRow({ payload, userId, brokerAccountId, accountType, dealEntry: "in" });
      if ("error" in built) {
        return { res: NextResponse.json({ error: "Invalid trade payload" }, { status: 400 }), action: "error", positionId, resultStatus: "open" };
      }
      const openRow = {
        ...built.row,
        position_id: positionId,
        deal_entry:  "in",
        sl:          payload.sl || null,
        tp:          payload.tp || null,
        status:      "open",
        source:      "ea",
        verified:    true,
        visibility:  "private",
      };

      const { data: existingPos } = await supabase
        .from("trades")
        .select("id")
        .eq("user_id", userId)
        .eq("position_id", positionId)
        .maybeSingle();

      if (existingPos?.id) {
        await supabase.from("trades").update(openRow).eq("id", existingPos.id);
        tradeId = existingPos.id;
        action = "updated";
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from("trades")
          .insert(openRow)
          .select("id")
          .single();
        if (insertErr) {
          console.error("EA ingest: ENTRY_IN insert failed", { tokenId, code: insertErr.code, message: insertErr.message, details: insertErr.details, hint: insertErr.hint });
          return { res: NextResponse.json({ error: "Failed to save trade" }, { status: 500 }), action: "error", positionId, resultStatus: "open" };
        }
        tradeId = inserted?.id ?? null;
        action = "inserted";
      }
    }

    await logEvent(supabase, {
      trade_id:     tradeId,
      user_id:      userId,
      position_id:  positionId,
      order_ticket: payload.order_ticket ?? null,
      event_type:   "filled",
      price:        payload.open_price,
      sl:           payload.sl || null,
      tp:           payload.tp || null,
      lots:         payload.lots,
      event_time:   payload.open_time || null,
      raw:          { ticket: payload.ticket, type: payload.type, mergedFromPending },
    });

    resultStatus = "open";
    return {
      res: NextResponse.json({ success: true, action, position_id: positionId, status: resultStatus }, { status: 200 }),
      action,
      positionId,
      resultStatus,
    };
  }

  // ── ENTRY_OUT ──────────────────────────────────────────────────────────────
  if (MIGRATIONS_APPLIED && dealEntry === "out" && positionId) {
    const { data: openTrade, error: findErr } = await supabase
      .from("trades")
      .select("id, status")
      .eq("user_id", userId)
      .eq("position_id", positionId)
      .maybeSingle();

    if (findErr) {
      console.error("EA ingest: position lookup error", { tokenId, code: findErr.code, message: findErr.message, details: findErr.details, hint: findErr.hint });
      return { res: NextResponse.json({ error: "Failed to save trade" }, { status: 500 }), action: "error", positionId, resultStatus: "closed" };
    }

    if (openTrade?.id) {
      const rowStatus = (openTrade as { id: string; status?: string | null }).status;

      if (rowStatus === "closed") {
        // Double-close guard: row is already closed — this is a partial close event.
        // Log it but do NOT overwrite the closed row.
        await logEvent(supabase, {
          trade_id:    openTrade.id,
          user_id:     userId,
          position_id: positionId,
          event_type:  "partial_close",
          price:       payload.close_price || null,
          pnl:         payload.profit ?? null,
          lots:        payload.lots || null,
          event_time:  payload.close_time || null,
          raw:         { ticket: payload.ticket, profit: payload.profit },
        });
        return {
          res: NextResponse.json({ success: true, action: "partial_close", position_id: positionId, status: "closed" }, { status: 200 }),
          action: "partial_close",
          positionId,
          resultStatus: "closed",
        };
      }

      // Normal close.
      const { error: closeErr } = await supabase
        .from("trades")
        .update({
          exit_price:  payload.close_price || null,
          close_time:  payload.close_time || null,
          pnl:         payload.profit ?? null,
          swap:        payload.swap ?? null,
          commission:  payload.commission ?? null,
          rr_ratio:    payload.r_multiple ? payload.r_multiple : null,
          r_multiple:  payload.r_multiple || null,
          result:      deriveEaResult(payload.profit),
          deal_entry:  "out",
          status:      "closed",
          source:      "ea",
          verified:    true,
        })
        .eq("id", openTrade.id)
        .eq("user_id", userId);

      if (closeErr) {
        console.error("EA ingest: failed to save trade", { tokenId, code: closeErr.code, message: closeErr.message, details: closeErr.details, hint: closeErr.hint });
        return { res: NextResponse.json({ error: "Failed to save trade" }, { status: 500 }), action: "error", positionId, resultStatus: "closed" };
      }

      await logEvent(supabase, {
        trade_id:    openTrade.id,
        user_id:     userId,
        position_id: positionId,
        event_type:  "closed",
        price:       payload.close_price || null,
        pnl:         payload.profit ?? null,
        lots:        payload.lots || null,
        event_time:  payload.close_time || null,
        raw:         { ticket: payload.ticket, swap: payload.swap, commission: payload.commission, r_multiple: payload.r_multiple },
      });

      action = "updated";
    } else {
      // EA installed mid-trade — no open row exists; insert a complete closed row.
      const built = buildEaTradeRow({ payload, userId, brokerAccountId, accountType, dealEntry: "out" });
      if ("error" in built) {
        return { res: NextResponse.json({ error: "Invalid trade payload" }, { status: 400 }), action: "error", positionId, resultStatus: "closed" };
      }
      const closedRow = {
        ...built.row,
        position_id: positionId,
        deal_entry:  "out",
        sl:          payload.sl || null,
        tp:          payload.tp || null,
        r_multiple:  payload.r_multiple || null,
        rr_ratio:    payload.r_multiple ? payload.r_multiple : null,
        status:      "closed",
        source:      "ea",
        verified:    true,
        visibility:  "private",
      };
      const { data: inserted, error: insertErr } = await supabase
        .from("trades")
        .insert(closedRow)
        .select("id")
        .single();
      if (insertErr) {
        console.error("EA ingest: failed to save trade", { tokenId, code: insertErr.code, message: insertErr.message, details: insertErr.details, hint: insertErr.hint });
        return { res: NextResponse.json({ error: "Failed to save trade" }, { status: 500 }), action: "error", positionId, resultStatus: "closed" };
      }
      await logEvent(supabase, {
        trade_id:    inserted?.id ?? null,
        user_id:     userId,
        position_id: positionId,
        event_type:  "closed",
        price:       payload.close_price || null,
        pnl:         payload.profit ?? null,
        event_time:  payload.close_time || null,
        raw:         { ticket: payload.ticket, note: "mid_trade_install" },
      });
      action = "inserted";
    }

    resultStatus = "closed";
    return {
      res: NextResponse.json({ success: true, action, position_id: positionId, status: resultStatus }, { status: 200 }),
      action,
      positionId,
      resultStatus,
    };
  }

  // ── Legacy ticket-based upsert ─────────────────────────────────────────────
  // Used when MIGRATIONS_APPLIED=false OR the payload has no deal_entry/position_id.
  if (!MIGRATIONS_APPLIED && (dealEntry || positionId)) {
    console.warn(
      "EA ingest: position-aware path skipped — MIGRATIONS_APPLIED is not set.",
      { dealEntry, positionId, tokenId },
    );
  }

  const { data: existingTrade, error: lookupError } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", userId)
    .eq("ticket", payload.ticket)
    .maybeSingle();

  if (lookupError) {
    console.error("EA ingest: trade lookup error", { tokenId, code: lookupError.code, message: lookupError.message, details: lookupError.details, hint: lookupError.hint });
    return { res: NextResponse.json({ error: "Failed to save trade" }, { status: 500 }), action: "error", positionId, resultStatus: "closed" };
  }

  const built = buildEaTradeRow({ payload, userId, brokerAccountId, accountType, dealEntry });
  if ("error" in built) {
    return { res: NextResponse.json({ error: "Invalid trade payload" }, { status: 400 }), action: "error", positionId, resultStatus: "closed" };
  }

  const legacyRow = MIGRATIONS_APPLIED
    ? { ...built.row, source: "ea" as const, verified: true, visibility: "private" }
    : { ...built.row, visibility: "private" };

  let saveError: { code: string; message: string; details: string; hint: string } | null = null;
  if (existingTrade?.id) {
    const { error } = await supabase.from("trades").update(legacyRow).eq("id", existingTrade.id).eq("user_id", userId);
    saveError = error ?? null;
    action = "updated";
  } else {
    const { error } = await supabase.from("trades").insert(legacyRow);
    saveError = error ?? null;
    action = "inserted";
  }

  if (saveError) {
    console.error("EA ingest: failed to save trade", { tokenId, code: saveError.code, message: saveError.message, details: saveError.details, hint: saveError.hint });
    return { res: NextResponse.json({ error: "Failed to save trade" }, { status: 500 }), action: "error", positionId, resultStatus: "closed" };
  }

  return {
    res: NextResponse.json({ success: true, action, position_id: positionId, status: resultStatus }, { status: 200 }),
    action,
    positionId,
    resultStatus,
  };
}

// ── handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  const raw = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const hash = hashToken(raw);

  // 2. Token lookup
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

  const userId        = tokenRow.user_id;
  const tokenId       = tokenRow.id;
  const brokerAccountId = tokenRow.broker_account_id ?? null;
  const encryptedSecret =
    tokenRow.signing_secret_ciphertext &&
    tokenRow.signing_secret_iv &&
    tokenRow.signing_secret_tag &&
    tokenRow.signing_secret_key_version != null
      ? {
          ciphertext: tokenRow.signing_secret_ciphertext,
          iv:         tokenRow.signing_secret_iv,
          tag:        tokenRow.signing_secret_tag,
          keyVersion: tokenRow.signing_secret_key_version,
        }
      : null;

  // 3. Protocol version
  const protocolHeader = req.headers.get("x-ingest-protocol");
  if (protocolHeader && protocolHeader !== PROTOCOL_VERSION) {
    return NextResponse.json({ error: "Unsupported protocol version" }, { status: 400 });
  }
  const isV2 = protocolHeader === PROTOCOL_VERSION;

  if (!isV2 && encryptedSecret) {
    return NextResponse.json(
      { error: "This token requires the v2 ingest protocol. Update your EA to the latest version." },
      { status: 401 },
    );
  }
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

  // 4. Rate limit
  const rateRes = await supabase.rpc("ea_ingest_rate_check_and_log", {
    p_token_hash: hash,
    p_limit: TOKEN_RATE_LIMIT,
    p_window_sec: TOKEN_RATE_WINDOW_SEC,
  });
  if (rateRes.error) {
    console.error("EA ingest rate-limit RPC failed:", rateRes.error.message);
    return NextResponse.json({ error: "Ingest temporarily unavailable" }, { status: 503 });
  }
  const newCount = typeof rateRes.data === "number" ? rateRes.data : 0;
  if (newCount > TOKEN_RATE_LIMIT) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // 5. Read + parse body
  const bodyText = await readCappedBody(req);
  if (bodyText === null) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 6. Detect event type and validate with the appropriate schema.
  //    event_type present → order lifecycle event (eaOrderSchema)
  //    otherwise          → market fill / deal (eaDealSchema)
  const rawObj = parsedJson as Record<string, unknown>;
  const isOrderEvent = typeof rawObj.event_type === "string";

  let orderPayload: EaOrderPayload | undefined;
  let dealPayload: EaDealPayload | undefined;

  if (isOrderEvent) {
    const parsed = eaOrderSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("EA ingest: invalid order payload", { tokenId, issues: parsed.error.issues });
      return NextResponse.json({ error: "Invalid order payload", issues: parsed.error.issues }, { status: 400 });
    }
    orderPayload = parsed.data;
  } else {
    const parsed = eaDealSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("EA ingest: invalid trade payload", { tokenId, issues: parsed.error.issues });
      return NextResponse.json({ error: "Invalid trade payload", issues: parsed.error.issues }, { status: 400 });
    }
    dealPayload = parsed.data;
  }

  // 7. v2 envelope verify (after schema validation so the hash has a clean payload)
  let envelopeForReplay: V2Envelope | null = null;
  if (isV2) {
    const env = await validateV2Envelope({
      parsedJson,
      isOrderEvent,
      orderPayload,
      dealPayload,
      tokenId,
      userId,
      encryptedSecret,
    });
    if (!env.ok) return env.res;
    envelopeForReplay = env.envelope;
  }

  // 8. Account type lookup (for trust_badge derivation)
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

  // 9. Nonce record (v2 only — before any DB writes)
  if (isV2 && envelopeForReplay) {
    const nonceRes = await recordNonce(supabase, hash, envelopeForReplay);
    if (!nonceRes.ok) return nonceRes.res;
  }

  // 10. Dispatch to the appropriate handler
  let finalRes: NextResponse;
  let positionId: string | null = null;

  if (isOrderEvent && orderPayload) {
    finalRes = await handleOrderEvent(supabase, orderPayload, userId, tokenId, brokerAccountId, accountType);
  } else if (dealPayload) {
    const result = await handleDealEvent(supabase, dealPayload, userId, tokenId, brokerAccountId, accountType);
    finalRes   = result.res;
    positionId = result.positionId;
  } else {
    finalRes = NextResponse.json({ error: "Unrecognised payload" }, { status: 400 });
  }

  // 11. Update token last_used_at (best-effort)
  await supabase
    .from("ea_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  // 12. Score recalc (best-effort; never fail ingest on error)
  if (brokerAccountId) {
    const scoreResult = await recalculateAccountScoreWithClient(supabase, userId, brokerAccountId);
    if ("error" in scoreResult) {
      console.error("EA ingest: score recalc error", { tokenId });
    }
  }

  return finalRes;
}
