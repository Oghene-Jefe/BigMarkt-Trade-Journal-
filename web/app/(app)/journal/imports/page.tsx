import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import ImportsTable, { type PendingImport } from "./ImportsTable";

export const dynamic = "force-dynamic";

type ConnectionRow = { id: string; account_label: string | null };

export default async function JournalImportsPage() {
  const sb = await supabaseServer();

  // Pull pending closed-PnL rows + a sidecar map of connection labels.
  // Two queries instead of a join because postgrest's nested-select syntax
  // would carry the encrypted credential columns (which we never want in
  // a page payload).
  const [{ data: pending }, { data: connections }] = await Promise.all([
    sb
      .from("exchange_closed_pnl")
      .select(
        "id, connection_id, exchange, category, symbol, side, qty, closed_size, " +
        "avg_entry_price, avg_exit_price, closed_pnl, open_fee, close_fee, " +
        "closed_at, exchange_order_id",
      )
      .eq("import_status", "pending")
      .order("closed_at", { ascending: false }),
    sb.from("exchange_connections").select("id, account_label"),
  ]);

  const labelByConnection = new Map<string, string | null>();
  for (const c of (connections ?? []) as ConnectionRow[]) {
    labelByConnection.set(c.id, c.account_label);
  }

  // supabase-js v2 typings choke on long select strings → cast via unknown.
  const pendingRows = (pending ?? []) as unknown as Array<PendingImport & { connection_id: string }>;
  const rows: PendingImport[] = pendingRows.map((r) => ({
    id: r.id,
    exchange: r.exchange,
    category: r.category,
    symbol: r.symbol,
    side: r.side,
    qty: r.qty,
    closed_size: r.closed_size,
    avg_entry_price: r.avg_entry_price,
    avg_exit_price: r.avg_exit_price,
    closed_pnl: r.closed_pnl,
    open_fee: r.open_fee,
    close_fee: r.close_fee,
    closed_at: r.closed_at,
    exchange_order_id: r.exchange_order_id,
    connection_label: labelByConnection.get(r.connection_id) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Imports</h1>
          <p className="mt-1 text-xs text-muted">
            Closed-PnL rows synced from your exchange connections. Approve to create journal trades,
            or ignore to dismiss.
          </p>
        </div>
        <Link
          href="/exchanges"
          className="inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-xs text-muted hover:bg-white/5 hover:text-white"
        >
          Manage connections
        </Link>
      </div>

      <ImportsTable rows={rows} />
    </div>
  );
}
