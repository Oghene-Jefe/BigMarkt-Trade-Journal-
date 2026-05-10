// Sync logic for Bybit closed-PnL + executions. Pure async functions —
// they take a Supabase client, an environment, and credentials, then
// fetch the data, paginate, and upsert. Caller decides windowing,
// concurrency, sync_run row management.
//
// Idempotency is delegated entirely to DB unique constraints:
//   exchange_closed_pnl: (connection_id, exchange, category, exchange_order_id,
//                         closed_at, closed_size, closed_pnl)
//   exchange_fills:      (connection_id, exchange, category, exchange_fill_id)
//
// Re-running a sync over the same window is a no-op for already-stored rows.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BybitCategory,
  BybitClosedPnlRecord,
  BybitExecutionRecord,
  ExchangeCredentials,
  ExchangeEnvironment,
} from "../types";
import { getClosedPnl, getExecutions } from "./client";

const PAGE_SIZE = 100;        // Bybit max per page
const MAX_PAGES = 50;         // safety cap; 5,000 rows per window per endpoint

export type SyncCounts = {
  fetched: number;
  inserted: number;
  duplicates: number;
};

export async function syncClosedPnlForWindow(args: {
  sb: SupabaseClient;
  creds: ExchangeCredentials;
  env: ExchangeEnvironment;
  category: BybitCategory;
  userId: string;
  connectionId: string;
  syncRunId: string;
  startMs: number;
  endMs: number;
}): Promise<SyncCounts> {
  const counts: SyncCounts = { fetched: 0, inserted: 0, duplicates: 0 };
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { list, nextPageCursor } = await getClosedPnl(args.creds, args.env, {
      category: args.category,
      startTime: args.startMs,
      endTime: args.endMs,
      limit: PAGE_SIZE,
      cursor,
    });
    counts.fetched += list.length;
    if (list.length > 0) {
      const rows = list.map((r) => closedPnlRow(r, args));
      // Upsert with onConflict so duplicates from previous syncs are silently
      // ignored (PostgREST's "resolution=ignore-duplicates" semantic).
      const { data: insertedRows, error } = await args.sb
        .from("exchange_closed_pnl")
        .upsert(rows, {
          onConflict:
            "connection_id,exchange,category,exchange_order_id,closed_at,closed_size,closed_pnl",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw error;
      const inserted = insertedRows?.length ?? 0;
      counts.inserted += inserted;
      counts.duplicates += list.length - inserted;
    }
    if (!nextPageCursor) break;
    cursor = nextPageCursor;
  }
  return counts;
}

export async function syncExecutionsForWindow(args: {
  sb: SupabaseClient;
  creds: ExchangeCredentials;
  env: ExchangeEnvironment;
  category: BybitCategory;
  userId: string;
  connectionId: string;
  syncRunId: string;
  startMs: number;
  endMs: number;
}): Promise<SyncCounts> {
  const counts: SyncCounts = { fetched: 0, inserted: 0, duplicates: 0 };
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { list, nextPageCursor } = await getExecutions(args.creds, args.env, {
      category: args.category,
      startTime: args.startMs,
      endTime: args.endMs,
      limit: PAGE_SIZE,
      cursor,
    });
    counts.fetched += list.length;
    if (list.length > 0) {
      const rows = list.map((r) => fillRow(r, args));
      const { data: insertedRows, error } = await args.sb
        .from("exchange_fills")
        .upsert(rows, {
          onConflict: "connection_id,exchange,category,exchange_fill_id",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw error;
      const inserted = insertedRows?.length ?? 0;
      counts.inserted += inserted;
      counts.duplicates += list.length - inserted;
    }
    if (!nextPageCursor) break;
    cursor = nextPageCursor;
  }
  return counts;
}

// ---- row builders ---------------------------------------------------------

function closedPnlRow(
  r: BybitClosedPnlRecord,
  ctx: { userId: string; connectionId: string; syncRunId: string; env: ExchangeEnvironment; category: BybitCategory },
) {
  return {
    user_id: ctx.userId,
    connection_id: ctx.connectionId,
    sync_run_id: ctx.syncRunId,
    exchange: "bybit",
    environment: ctx.env,
    category: ctx.category,
    exchange_order_id: r.orderId,
    symbol: r.symbol,
    side: r.side,
    qty: r.qty,
    closed_size: r.closedSize,
    avg_entry_price: r.avgEntryPrice,
    avg_exit_price: r.avgExitPrice,
    closed_pnl: r.closedPnl,
    open_fee: r.openFee,
    close_fee: r.closeFee,
    leverage: r.leverage,
    order_type: r.orderType,
    exec_type: r.execType,
    opened_at: r.createdAt,
    closed_at: r.closedAt,
    raw_payload: r.raw as Record<string, unknown>,
    import_status: "pending",
  };
}

function fillRow(
  r: BybitExecutionRecord,
  ctx: { userId: string; connectionId: string; syncRunId: string; env: ExchangeEnvironment; category: BybitCategory },
) {
  return {
    user_id: ctx.userId,
    connection_id: ctx.connectionId,
    sync_run_id: ctx.syncRunId,
    exchange: "bybit",
    environment: ctx.env,
    category: ctx.category,
    exchange_order_id: r.orderId,
    exchange_fill_id: r.execId,
    symbol: r.symbol,
    side: r.side,
    order_price: r.orderPrice,
    order_qty: r.orderQty,
    exec_price: r.execPrice,
    exec_qty: r.execQty,
    exec_value: r.execValue,
    exec_fee: r.execFee,
    fee_currency: r.feeCurrency,
    fee_rate: r.feeRate,
    exec_type: r.execType,
    is_maker: r.isMaker,
    seq: r.seq,
    executed_at: r.executedAt,
    raw_payload: r.raw as Record<string, unknown>,
  };
}
