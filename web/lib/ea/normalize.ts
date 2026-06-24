import { z } from "zod";

// ── shared helpers ────────────────────────────────────────────────────────────

const finiteBounded = (max: number) =>
  z.number().refine((n) => Number.isFinite(n) && Math.abs(n) <= max, {
    message: `value must be finite and |value| ≤ ${max}`,
  });

// Broker timestamp: empty/missing → null, otherwise must be an ISO-parseable
// instant inside the sane window [2020-01-01, now + ~2 years]. Rejects garbage
// strings and absurd pre-2020 / far-future dates.
const MIN_TS = Date.parse("2020-01-01T00:00:00Z");
const eaTimestamp = z
  .string()
  .default("")
  .transform((v) => v || null)
  .refine(
    (v) => {
      if (v === null) return true;
      const t = Date.parse(v);
      if (!Number.isFinite(t)) return false;
      // ~2 years ahead, minus a day of slack so a timestamp computed as exactly
      // "now + 2y" by a caller is reliably rejected despite clock drift.
      const maxTs = Date.now() + (2 * 365 - 1) * 24 * 3600 * 1000;
      return t >= MIN_TS && t <= maxTs;
    },
    { message: "timestamp must be ISO and within [2020, now+2y]" },
  );

// EA v2.5.0 unsigned-passthrough account snapshot. These ride on EVERY payload
// and are deliberately OUTSIDE every field_hash / signature computation — they
// are never added to TRADE_FIELD_ORDER or orderFieldsHash. Optional so older
// EA builds (which omit them) still parse.
const accountPassthrough = {
  account_balance:  z.number().optional(),
  account_equity:   z.number().optional(),
  account_currency: z.string().max(16).optional(),
  // Set when the EA replays historical/closed deals on startup. Their
  // account_balance/account_equity are a CURRENT snapshot, NOT the
  // point-in-time balance for the historical trade — so the route must not
  // stamp them as a per-trade balance_at_open/equity_at_open. Unsigned
  // passthrough, deliberately OUTSIDE every field_hash.
  backfill: z.boolean().optional(),
};

// ── eaOrderSchema ─────────────────────────────────────────────────────────────
// Used when event_type is present (TRADE_TRANSACTION_ORDER_ADD/UPDATE/DELETE).
// These events never carry a deal ticket — requiring it was the root cause of
// the 400 errors on order events.
//
// Required: event_type, order_ticket, symbol, type.
// Optional: price/sl/tp/lots/timing/meta — a broker may omit any of these.

export const eaOrderSchema = z.object({
  event_type: z.enum(["order_add", "order_update", "order_delete"]),
  order_ticket: z.coerce.string().min(1),
  symbol: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9$.#_-]{1,32}$/, "symbol contains invalid characters")
    .transform((s) => s.toUpperCase()),
  type: z
    .string()
    .min(1)
    .max(32)
    .refine((s) => /buy|sell/i.test(s), "type must contain buy or sell"),
  // Optional fields — all default to 0 / '' so the route can write nullif(x,0).
  lots:        finiteBounded(10_000).default(0),
  open_price:  finiteBounded(1_000_000_000).default(0),
  sl:          z.number().default(0),
  tp:          z.number().default(0),
  order_time:  z.string().max(40).optional(),
  magic:       z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  comment:     z.string().max(500).default(""),
  // Position linkage — sent by newer EA builds when an order fills.
  position_id: z.coerce.string().optional(),
  ...accountPassthrough,
});

export type EaOrderPayload = z.infer<typeof eaOrderSchema>;

// ── eaDealSchema ──────────────────────────────────────────────────────────────
// Used for market fills: DEAL_ENTRY_IN and DEAL_ENTRY_OUT.
// Ticket is required here because deal rows are keyed by it for legacy fallback.

export const eaDealSchema = z.object({
  ticket: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  symbol: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9$.#_-]{1,32}$/, "symbol contains invalid characters")
    .transform((s) => s.toUpperCase()),
  type: z
    .string()
    .min(1)
    .max(32)
    .refine((s) => /buy|sell/i.test(s), "type must contain buy or sell"),
  lots: finiteBounded(10_000),
  open_price: finiteBounded(1_000_000_000),
  close_price: finiteBounded(1_000_000_000).default(0),
  open_time:  eaTimestamp,
  close_time: eaTimestamp,
  profit: finiteBounded(1_000_000_000).default(0),
  swap:   finiteBounded(1_000_000_000).default(0),
  commission: finiteBounded(1_000_000_000).default(0),
  magic:   z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  comment: z.string().max(500).default(""),
  position_id: z.coerce.string().optional(),
  deal_entry:  z.enum(["in", "out"]).optional(),
  sl:          z.number().default(0),
  tp:          z.number().default(0),
  r_multiple:  z.number().default(0),
  // order_ticket forwarded by the EA so the ingest route can link a fill to its
  // pending-order row.  Coerced to string since JSON may send it as a number.
  order_ticket: z.coerce.string().optional(),
  ...accountPassthrough,
}).superRefine((data, ctx) => {
  // open_price=0 is valid for ENTRY_OUT (closing) deals.
  if (data.deal_entry !== "out" && data.open_price <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["open_price"],
      message: "open_price must be > 0 for opening deals",
    });
  }
  // lots=0 is valid for ENTRY_OUT closing deals.
  if (data.deal_entry !== "out" && data.lots <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lots"],
      message: "lots must be > 0 for opening deals",
    });
  }
});

export type EaDealPayload = z.infer<typeof eaDealSchema>;

// ── eaPositionModifySchema ─────────────────────────────────────────────────────
// EA v2.5.0 "position_modify" event — a live SL/TP change on an already-open
// position. Field_hash recipe (LF-separated, no trailing newline):
//   event_type=position_modify
//   position_id=<id>
//   symbol=<SYMBOL_UPPER>
//   sl=<canonical>
//   tp=<canonical>
// See positionModifyFieldsHash() in lib/ea/sig.ts.

export const eaPositionModifySchema = z.object({
  event_type: z.literal("position_modify"),
  position_id: z.coerce.string().min(1),
  symbol: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9$.#_-]{1,32}$/, "symbol contains invalid characters")
    .transform((s) => s.toUpperCase()),
  sl: z.number().default(0),
  tp: z.number().default(0),
  magic: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  // EA v2.5.1: broker-clock timestamp of the modify (same basis as deal
  // open_time/close_time). Unsigned passthrough — NOT part of
  // positionModifyFieldsHash / the signature. Used only to order the timeline.
  event_time: z.string().max(40).optional(),
  ...accountPassthrough,
});

export type EaPositionModifyPayload = z.infer<typeof eaPositionModifySchema>;

// ── eaOpenSnapshotSchema ────────────────────────────────────────────────────────
// EA v2.7.1 "open_snapshot" full-mirror event. The EA sends the COMPLETE set of
// positions it currently sees open on the terminal WITH detail, plus the live
// pending ORDER tickets. The server makes the journal's live state match the
// broker exactly: OPEN missing positions, REPAIR drifted lots/SL/TP, CLOSE
// orphans, and CANCEL stuck pending rows. An EMPTY positions[] is valid (an
// account can legitimately have zero open positions — the EA only sends while
// TERMINAL_CONNECTED).
//
// Field_hash recipe (LF-separated, no trailing newline) — see
// openSnapshotFieldsHash() in lib/ea/sig.ts:
//   event_type=open_snapshot
//   position=<id>|<SYM>|<dir>|<lots>|<open>|<sl>|<tp>|<openTimeISO>   (one per position)
//   pending=<ticket csv>
const eaSnapshotPositionId = z.coerce
  .string()
  .regex(/^\d+$/, "position_id must be digits only");

const eaSnapshotPosition = z.object({
  position_id: eaSnapshotPositionId,
  symbol: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9$.#_-]{1,32}$/, "symbol contains invalid characters")
    .transform((s) => s.toUpperCase()),
  type: z.enum(["buy", "sell"]),
  lots:       z.coerce.number(),
  open_price: z.coerce.number(),
  sl:         z.coerce.number(),
  tp:         z.coerce.number(),
  // ISO8601 broker-clock open time; empty allowed. Hashed verbatim.
  open_time:  z.string().max(40).default(""),
});

export const eaOpenSnapshotSchema = z.object({
  event_type: z.literal("open_snapshot"),
  positions: z.array(eaSnapshotPosition).max(5000),
  // Optional so a missing field means "skip the pending reconcile" (never
  // "cancel all"); v2.7.1 always sends it (possibly an empty array).
  pending_tickets: z.array(eaSnapshotPositionId).max(5000).optional(),
  ...accountPassthrough,
});

export type EaOpenSnapshotPayload = z.infer<typeof eaOpenSnapshotSchema>;

// Unified payload type used inside the route after the branch.
export type EaTradePayload = EaDealPayload;

// Keep the old name as an alias so any callers outside the route still compile.
export const eaTradeSchema = eaDealSchema;

// ── derivations ───────────────────────────────────────────────────────────────

export function deriveEaResult(profit?: number): "WIN" | "LOSS" | "BE" {
  if (!profit || profit === 0) return "BE";
  return profit > 0 ? "WIN" : "LOSS";
}

export function deriveEaDirection(type: string): "BUY" | "SELL" | null {
  const t = type.toLowerCase();
  if (t.includes("buy")) return "BUY";
  if (t.includes("sell")) return "SELL";
  return null;
}

export function buildEaTradeRow(args: {
  payload: EaDealPayload;
  userId: string;
  brokerAccountId?: string | null;
  accountType?: string | null;
  /** 'in' = opening deal (result is null — trade not yet closed)
   *  'out' = closing deal (result derived from profit)
   *  undefined = legacy / manual (result derived from profit) */
  dealEntry?: "in" | "out";
}) {
  const direction = deriveEaDirection(args.payload.type);
  if (!direction) return { error: "Trade type must include buy or sell" } as const;

  // Goal 3: demo accounts get trust_badge='demo' (constraint allows it since 0043).
  // Previously this mapped to 'manual', which made demo trades indistinguishable from
  // manual entries and allowed them to appear in public profiles.
  const trustBadge =
    args.accountType === "prop_firm"
      ? "prop_firm"
      : args.accountType === "demo"
        ? "demo"
        : "auto_verified";

  const row: Record<string, unknown> = {
    user_id: args.userId,
    ticket: args.payload.ticket,
    pair: args.payload.symbol,
    direction,
    lot_size: args.payload.lots,
    entry_price: args.payload.open_price,
    exit_price: args.payload.close_price ?? null,
    open_time: args.payload.open_time || null,
    close_time: args.payload.close_time ?? null,
    pnl: args.payload.profit ?? null,
    swap: args.payload.swap ?? null,
    commission: args.payload.commission ?? null,
    magic: args.payload.magic ?? null,
    comment: args.payload.comment ?? null,
    // Canonical stop_loss/take_profit written on every deal so the share card
    // shows them without having to fall back to the ea-only sl/tp columns.
    stop_loss:   args.payload.sl ? args.payload.sl : null,
    take_profit: args.payload.tp ? args.payload.tp : null,
    // Open trades have no result yet — only set on close (ENTRY_OUT).
    result: args.dealEntry === "in" ? null : deriveEaResult(args.payload.profit),
    capture_source: "ea",
    trust_badge: trustBadge,
    core_fields_locked: true,
    auto_approved: true,
  };
  if (args.brokerAccountId) row.broker_account_id = args.brokerAccountId;

  return { row } as const;
}
