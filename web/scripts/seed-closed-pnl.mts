/**
 * Seeds 4 realistic synthetic exchange_closed_pnl rows for Phase E
 * development. Identical shape to what Phase D's sync would produce
 * from real Bybit data — enough for the review UI to render against.
 *
 * Usage: node --import tsx scripts/seed-closed-pnl.mts <connection_id>
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const connectionId = process.argv[2];
if (!connectionId) throw new Error("usage: seed-closed-pnl <connection_id>");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const { data: conn } = await sb
  .from("exchange_connections")
  .select("user_id, environment")
  .eq("id", connectionId)
  .single();
if (!conn) throw new Error("connection not found");

const day = 86_400_000;
const now = Date.now();

type Fixture = {
  symbol: string; side: "Buy" | "Sell"; entry: number; exit: number;
  size: number; pnl: number; openedAgoDays: number; closedAgoDays: number;
};

const fixtures: Fixture[] = [
  { symbol: "BTCUSDT", side: "Buy",  entry: 67000, exit: 68500, size: 0.05, pnl: 75.0,  openedAgoDays: 6, closedAgoDays: 5 },
  { symbol: "ETHUSDT", side: "Sell", entry: 3520,  exit: 3460,  size: 0.5,  pnl: 30.0,  openedAgoDays: 4, closedAgoDays: 3 },
  { symbol: "SOLUSDT", side: "Buy",  entry: 145.2, exit: 142.0, size: 5,    pnl: -16.0, openedAgoDays: 3, closedAgoDays: 2 },
  { symbol: "BTCUSDT", side: "Sell", entry: 69100, exit: 68200, size: 0.02, pnl: 18.0,  openedAgoDays: 2, closedAgoDays: 1 },
];

const rows = fixtures.map((f, i) => {
  const orderId = `seed-${connectionId.slice(0, 8)}-${i}-${Date.now()}`;
  const opened = new Date(now - f.openedAgoDays * day);
  const closed = new Date(now - f.closedAgoDays * day);
  const fee = Math.abs(f.entry * f.size * 0.0006);
  return {
    user_id: conn.user_id,
    connection_id: connectionId,
    sync_run_id: null,
    exchange: "bybit",
    environment: conn.environment,
    category: "linear",
    exchange_order_id: orderId,
    symbol: f.symbol,
    side: f.side,
    qty: f.size,
    closed_size: f.size,
    avg_entry_price: f.entry,
    avg_exit_price: f.exit,
    closed_pnl: f.pnl,
    open_fee: fee,
    close_fee: fee,
    leverage: 10,
    order_type: "Market",
    exec_type: "Trade",
    opened_at: opened.toISOString(),
    closed_at: closed.toISOString(),
    raw_payload: { _synthetic: true, fixture: f },
    import_status: "pending",
  };
});

const { data, error } = await sb
  .from("exchange_closed_pnl")
  .upsert(rows, {
    onConflict: "connection_id,exchange,category,exchange_order_id,closed_at,closed_size,closed_pnl",
    ignoreDuplicates: true,
  })
  .select("id, symbol, side, closed_pnl, closed_at");

if (error) {
  console.error("✗", error);
  process.exit(1);
}

console.log(`✓ Seeded ${data?.length ?? 0} synthetic closed-PnL rows`);
console.table(data);
