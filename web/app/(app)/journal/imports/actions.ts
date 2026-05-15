"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

// Phase E: approve / ignore actions for the Bybit closed-PnL review UI.
//
// `approve` creates one BigMarkt `trades` row per selected `exchange_closed_pnl`
// row and links them via `exchange_import_mappings` (1:1, unique on both
// closed_pnl_id and trade_id, so double-approve is impossible at the DB level).
//
// `ignore` just stamps `import_status = 'ignored'`. The raw row stays for
// audit; only re-syncing the same window would re-create it, and the
// composite unique constraint catches that.

const idsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

function parseIds(formData: FormData): string[] | null {
  // Multiple checkboxes with name="ids" produce a single FormData key with
  // multiple entries. getAll() returns them as strings.
  const raw = formData.getAll("ids").filter((v): v is string => typeof v === "string");
  const parsed = idsSchema.safeParse({ ids: raw });
  return parsed.success ? parsed.data.ids : null;
}

export async function approveImportsAction(formData: FormData) {
  const ids = parseIds(formData);
  if (!ids) return;

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  // Fetch the closed-PnL rows the user owns (RLS-scoped). We also pull
  // connection_id for the mapping row + reject anything that's already
  // imported or ignored — only `pending` rows are valid for approval.
  type PendingForApproval = {
    id: string;
    connection_id: string;
    exchange: string;
    category: string;
    symbol: string;
    side: "Buy" | "Sell" | null;
    qty: number | null;
    closed_size: number | null;
    avg_entry_price: number | null;
    avg_exit_price: number | null;
    closed_pnl: number | null;
    open_fee: number | null;
    close_fee: number | null;
    exchange_order_id: string;
    opened_at: string | null;
    closed_at: string | null;
  };

  const { data } = await sb
    .from("exchange_closed_pnl")
    .select(
      "id, connection_id, exchange, category, symbol, side, qty, closed_size, " +
      "avg_entry_price, avg_exit_price, closed_pnl, open_fee, close_fee, " +
      "exchange_order_id, opened_at, closed_at",
    )
    .in("id", ids)
    .eq("user_id", user.id)
    .eq("import_status", "pending");

  // supabase-js v2 typings produce GenericStringError on long select strings
  // → cast via unknown to the explicit row type above.
  const pendingRows = (data ?? []) as unknown as PendingForApproval[];

  if (pendingRows.length === 0) {
    revalidatePath("/journal/imports");
    return;
  }

  for (const r of pendingRows) {
    // Build the trade row.
    //
    // Field-mapping decisions (Phase E):
    //   capture_source = 'manual'   — user clicked Approve
    //   trust_badge    = 'auto_verified' — data sourced from exchange API
    //   core_fields_locked = true   — prices/sizes came from Bybit; user
    //                                 shouldn't edit them later
    //   auto_approved  = false      — user-driven approval (not automatic)
    //   visibility     = 'private'  — sensible default; user can promote
    //
    // If you want a different shape for imported trades (e.g. unlocked
    // editing, different trust badge, public by default), this is the
    // place to change it.
    const direction = r.side === "Buy" ? "BUY" : "SELL";
    const closedPnl = Number(r.closed_pnl ?? 0);
    const result = closedPnl > 0 ? "WIN" : closedPnl < 0 ? "LOSS" : "BE";
    const openFee = Number(r.open_fee ?? 0);
    const closeFee = Number(r.close_fee ?? 0);
    const netPnl = closedPnl - openFee - closeFee;

    const tradeRow = {
      user_id: user.id,
      pair: r.symbol,
      direction,
      result,
      pnl: netPnl,
      entry_price: r.avg_entry_price,
      exit_price: r.avg_exit_price,
      lot_size: r.closed_size ?? r.qty,
      strategy: "Bybit Import",
      tags: "bybit,auto-import",
      notes:
        `Imported from Bybit ${r.exchange} ${r.category} closed PnL.\n` +
        `Order ID: ${r.exchange_order_id}\n` +
        `Closed at ${r.closed_at}`,
      visibility: "private" as const,
      trade_visibility: "private" as const,
      trust_badge: "auto_verified" as const,
      capture_source: "manual" as const,
      core_fields_locked: true,
      auto_approved: false,
    };

    const { data: insertedTrade, error: insErr } = await sb
      .from("trades")
      .insert(tradeRow)
      .select("id")
      .single();
    if (insErr || !insertedTrade) continue; // skip this row; others still process

    const { error: mapErr } = await sb
      .from("exchange_import_mappings")
      .insert({
        user_id: user.id,
        connection_id: r.connection_id,
        closed_pnl_id: r.id,
        trade_id: insertedTrade.id,
      });
    if (mapErr) {
      // Mapping is the dedupe safety; if it fails we should not leave an
      // orphaned trade row behind. Roll back the trade and skip.
      await sb.from("trades").delete().eq("id", insertedTrade.id);
      continue;
    }

    await sb
      .from("exchange_closed_pnl")
      .update({ import_status: "imported" })
      .eq("id", r.id);
  }

  revalidatePath("/journal/imports");
  revalidatePath("/journal");
  revalidatePath("/dashboard");
}

export async function ignoreImportsAction(formData: FormData) {
  const ids = parseIds(formData);
  if (!ids) return;

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  await sb
    .from("exchange_closed_pnl")
    .update({ import_status: "ignored" })
    .in("id", ids)
    .eq("user_id", user.id)
    .eq("import_status", "pending");

  revalidatePath("/journal/imports");
}
