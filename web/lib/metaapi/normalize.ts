// Normalize MetaStats trades → BigMarkt `trades` row shape.
//
// MetaApi is a READ-ONLY capture mechanism for a broker_accounts row, exactly
// like the EA. Trades captured here carry source='metaapi', capture_source=
// 'metaapi', and key on position_id like EA trades so they dedupe cleanly and
// every downstream system (scoring, dashboard filter, prop-firm lock,
// trust_badge, open-snapshot scoping) works unchanged.
//
// CONSERVATIVE v1: only fields the MetaStats docs confirm are mapped. Fields the
// documented models DON'T include — sl, tp, return_pct, r_multiple/rr_ratio —
// are left NULL. They get filled in a later refinement pass once we confirm the
// live payload (via MetaApi's RPC deals API if needed). This keeps cloud trades
// honest rather than fabricating values.
//
// Reuses deriveEaResult / deriveEaDirection from lib/ea/normalize.ts so MetaApi
// and EA trades derive direction + WIN/LOSS/BE identically.

import { deriveEaDirection, deriveEaResult } from "@/lib/ea/normalize";
import type { MetaStatsHistoricalTrade, MetaStatsOpenTrade } from "@/lib/metaapi/client";

// MetaStats timestamps: "YYYY-MM-DD HH:mm:ss.SSS" in UTC (space, no 'T', no
// zone). Convert to a real ISO-8601 instant with an explicit Z so Postgres
// stores correct UTC. Empty/garbage → null (never throw into the sync path).
export function metaStatsTimeToISO(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  // Replace the space between date and time with 'T', append Z if no zone given.
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(t)
    ? t.replace(" ", "T")
    : t.replace(" ", "T") + "Z";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

// nz: MetaStats (like MT5) uses 0 to mean "unset" for price-ish fields. Map 0 →
// null so the UI doesn't render a spurious 0.00. Genuine zeros (e.g. profit=0
// on a breakeven) are handled by the caller, NOT through nz.
const nz = (n: number | undefined | null): number | null =>
  typeof n === "number" && Number.isFinite(n) && n !== 0 ? n : null;

// Keying result — the writer (piece 3) decides which key to upsert on. position_id
// is preferred (matches EA path); external_id (_id) is the fallback when a closed
// trade carries no positionId.
export type MetaApiTradeKey = {
  position_id: string | null;
  external_id: string;   // MetaStats _id — always present, globally unique
};

export function metaApiTradeKey(
  t: MetaStatsHistoricalTrade | MetaStatsOpenTrade,
): MetaApiTradeKey {
  return {
    position_id: typeof t.positionId === "string" && t.positionId ? t.positionId : null,
    external_id: t._id,
  };
}

// Shared, docs-confirmed fields common to open + closed MetaStats trades.
type BaseTradeRow = {
  pair: string;
  direction: "BUY" | "SELL";
  lot_size: number | null;
  entry_price: number | null;
  open_time: string | null;
  source: "metaapi";
  capture_source: "metaapi";
  verified: true;
  // Conservative nulls — not in the documented MetaStats model. Filled later.
  stop_loss: null;
  take_profit: null;
  sl: null;
  tp: null;
  rr_ratio: null;
  r_multiple: null;
  return_pct: null;
};

function baseRow(
  t: MetaStatsHistoricalTrade | MetaStatsOpenTrade,
): { error: string } | BaseTradeRow {
  const direction = deriveEaDirection(t.type); // handles DEAL_TYPE_* and POSITION_TYPE_*
  if (!direction) return { error: `Unmappable trade type: ${t.type}` };
  return {
    pair: t.symbol,
    direction,
    lot_size: nz(t.volume),
    entry_price: nz(t.openPrice),
    open_time: metaStatsTimeToISO(t.openTime),
    source: "metaapi",
    capture_source: "metaapi",
    verified: true,
    stop_loss: null,
    take_profit: null,
    sl: null,
    tp: null,
    rr_ratio: null,
    r_multiple: null,
    return_pct: null,
  };
}

// ── CLOSED trade → row fields ────────────────────────────────────────────────
// deal_entry 'out', status 'closed'. pnl = profit; result derived from profit
// exactly like the EA path. exit_price/close_time mapped; return_pct still null
// (no per-trade balance baseline from MetaStats — derive in the refinement pass).
export function normalizeClosedTrade(
  t: MetaStatsHistoricalTrade,
): { error: string } | Record<string, unknown> {
  const base = baseRow(t);
  if ("error" in base) return base;
  const profit = typeof t.profit === "number" && Number.isFinite(t.profit) ? t.profit : null;
  return {
    ...base,
    exit_price: nz(t.closePrice),
    close_time: metaStatsTimeToISO(t.closeTime),
    pnl: profit,
    result: deriveEaResult(profit ?? undefined),
    deal_entry: "out",
    status: "closed",
  };
}

// ── OPEN trade → row fields ──────────────────────────────────────────────────
// deal_entry 'in', status 'open', no result yet. No exit/close/pnl on an open
// position. Mirrors the EA ENTRY_IN shape.
export function normalizeOpenTrade(
  t: MetaStatsOpenTrade,
): { error: string } | Record<string, unknown> {
  const base = baseRow(t);
  if ("error" in base) return base;
  return {
    ...base,
    exit_price: null,
    close_time: null,
    pnl: null,
    result: null,
    deal_entry: "in",
    status: "open",
  };
}
