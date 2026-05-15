export type EaTradePayload = {
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
};

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
  payload: EaTradePayload;
  userId: string;
  brokerAccountId?: string | null;
}) {
  const direction = deriveEaDirection(args.payload.type);
  if (!direction) return { error: "Trade type must include buy or sell" } as const;

  const row: Record<string, unknown> = {
    user_id: args.userId,
    ticket: args.payload.ticket,
    pair: args.payload.symbol,
    direction,
    lot_size: args.payload.lots,
    entry_price: args.payload.open_price,
    exit_price: args.payload.close_price ?? null,
    open_time: args.payload.open_time,
    close_time: args.payload.close_time ?? null,
    pnl: args.payload.profit ?? null,
    swap: args.payload.swap ?? null,
    commission: args.payload.commission ?? null,
    magic: args.payload.magic ?? null,
    comment: args.payload.comment ?? null,
    result: deriveEaResult(args.payload.profit),
    capture_source: "ea",
    trust_badge: "auto_verified",
    core_fields_locked: true,
    auto_approved: true,
  };
  if (args.brokerAccountId) row.broker_account_id = args.brokerAccountId;

  return { row } as const;
}
