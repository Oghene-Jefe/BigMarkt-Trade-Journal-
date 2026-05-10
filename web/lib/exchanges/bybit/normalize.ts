// Convert raw Bybit V5 REST payloads to our normalised shapes.
// Numbers come from Bybit as strings ("0.0001"); empty strings mean absent.
// Timestamps come as ms-since-epoch strings.

import type { BybitClosedPnlRecord, BybitExecutionRecord } from "../types";

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string" || v === "") return null;
  return v;
}

function msToIso(v: unknown): string | null {
  const n = num(v);
  if (n == null) return null;
  return new Date(n).toISOString();
}

function side(v: unknown): "Buy" | "Sell" {
  return v === "Sell" ? "Sell" : "Buy";
}

export function normalizeClosedPnl(raw: Record<string, unknown>): BybitClosedPnlRecord {
  return {
    symbol: String(raw.symbol ?? ""),
    orderId: String(raw.orderId ?? ""),
    side: side(raw.side),
    qty: num(raw.qty),
    closedSize: num(raw.closedSize),
    avgEntryPrice: num(raw.avgEntryPrice),
    avgExitPrice: num(raw.avgExitPrice),
    closedPnl: num(raw.closedPnl),
    openFee: num(raw.openFee),
    closeFee: num(raw.closeFee),
    leverage: num(raw.leverage),
    orderType: str(raw.orderType),
    execType: str(raw.execType),
    // Fall back to closedAt if createdTime missing — closed-pnl rows always
    // have updatedTime; createdTime is the rare missing field.
    createdAt: msToIso(raw.createdTime) ?? msToIso(raw.updatedTime) ?? new Date(0).toISOString(),
    closedAt: msToIso(raw.updatedTime) ?? msToIso(raw.createdTime) ?? new Date(0).toISOString(),
    raw,
  };
}

export function normalizeExecution(raw: Record<string, unknown>): BybitExecutionRecord {
  return {
    symbol: String(raw.symbol ?? ""),
    orderId: String(raw.orderId ?? ""),
    orderLinkId: str(raw.orderLinkId),
    side: side(raw.side),
    orderPrice: num(raw.orderPrice),
    orderQty: num(raw.orderQty),
    execPrice: num(raw.execPrice),
    execQty: num(raw.execQty),
    execValue: num(raw.execValue),
    execFee: num(raw.execFee),
    feeRate: num(raw.feeRate),
    feeCurrency: str(raw.feeCurrency),
    execType: str(raw.execType),
    isMaker: raw.isMaker === true || raw.isMaker === "true",
    closedSize: num(raw.closedSize),
    seq: raw.seq != null && raw.seq !== "" ? String(raw.seq) : null,
    execId: String(raw.execId ?? ""),
    executedAt: msToIso(raw.execTime) ?? new Date(0).toISOString(),
    raw,
  };
}
