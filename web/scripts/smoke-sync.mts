/**
 * Exercises the Phase D sync code path against real Bybit testnet, using
 * the connection stored by smoke-bybit.mts.
 *
 * Same trade-off as smoke-bybit.mts: we don't import the production
 * `lib/exchanges/bybit/*` modules because they pull `server-only` which
 * throws under tsx. Instead we reach for the same primitives (HMAC,
 * AES-GCM, HKDF) and replicate the action's outer shape.
 *
 * Usage:
 *   cd web
 *   node --import tsx scripts/smoke-sync.mts <connection_id>
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  createDecipheriv,
  createHmac,
  hkdfSync,
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const connectionId = process.argv[2];
if (!connectionId) throw new Error("usage: smoke-sync <connection_id>");

const masterKeyB64 = process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY!;
const masterKey = Buffer.from(masterKeyB64, "base64").subarray(0, 32);

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// ---- decrypt credential helper (mirrors lib/exchanges/crypto.ts) -----------
function deriveKey(salt: Buffer, uid: string): Buffer {
  const info = Buffer.from(`bigmarkt-exchange-credential|v1|${uid}`, "utf8");
  return Buffer.from(hkdfSync("sha256", masterKey, salt, info, 32));
}
function decryptCredential(blob: string, uid: string, salt: Buffer): string {
  const { iv, ct, tag } = JSON.parse(blob);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(salt, uid),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ct, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// ---- Bybit signing + paged GET --------------------------------------------
function signBybit(
  apiKey: string,
  apiSecret: string,
  query: string,
): { headers: Record<string, string>; ts: string; recvWindow: string } {
  const ts = String(Date.now());
  const recvWindow = "5000";
  const sig = createHmac("sha256", apiSecret)
    .update(ts + apiKey + recvWindow + query)
    .digest("hex");
  return {
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "X-BAPI-SIGN": sig,
      "User-Agent": "BigMarkt-smoke-sync/1.0",
    },
    ts,
    recvWindow,
  };
}

async function pagedGet(
  apiKey: string,
  apiSecret: string,
  baseUrl: string,
  path: string,
  params: Record<string, string | number>,
): Promise<unknown[]> {
  const out: unknown[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) sp.append(k, String(v));
    if (cursor) sp.append("cursor", cursor);
    const query = sp.toString();
    const { headers } = signBybit(apiKey, apiSecret, query);
    const res = await fetch(`${baseUrl}${path}?${query}`, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    if (json.retCode !== 0) {
      throw new Error(`Bybit ${json.retCode}: ${json.retMsg}`);
    }
    const list: unknown[] = json.result?.list ?? [];
    out.push(...list);
    cursor = json.result?.nextPageCursor || undefined;
    if (!cursor) break;
  }
  return out;
}

// ---- helpers for normalisation (mirrors lib/exchanges/bybit/normalize.ts) ---
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
function msToIso(v: unknown): string {
  const n = num(v);
  return n != null ? new Date(n).toISOString() : new Date(0).toISOString();
}

// ---- Run -----------------------------------------------------------------
console.log("→ loading exchange_connection", connectionId, "…");
const { data: conn, error: connErr } = await sb
  .from("exchange_connections")
  .select(
    "id, user_id, exchange, environment, encrypted_api_key, encrypted_api_secret, key_salt, last_sync_at",
  )
  .eq("id", connectionId)
  .single();
if (connErr || !conn) {
  console.error("✗ couldn't load:", connErr);
  process.exit(1);
}
console.log("  user:", conn.user_id, "  env:", conn.environment);

console.log("→ decrypting credentials…");
const salt = Buffer.from(conn.key_salt, "base64");
const apiKey = decryptCredential(conn.encrypted_api_key, conn.user_id, salt);
const apiSecret = decryptCredential(conn.encrypted_api_secret, conn.user_id, salt);
console.log("  ok");

const baseUrl = conn.environment === "testnet"
  ? "https://api-testnet.bybit.com"
  : "https://api.bybit.com";

const nowMs = Date.now();
const lastSyncMs = conn.last_sync_at ? new Date(conn.last_sync_at).getTime() : null;
const startMs = lastSyncMs
  ? Math.max(lastSyncMs - 24 * 60 * 60 * 1000, nowMs - 7 * 24 * 60 * 60 * 1000)
  : nowMs - 7 * 24 * 60 * 60 * 1000;

console.log(`→ syncing window ${new Date(startMs).toISOString()} → ${new Date(nowMs).toISOString()}`);

console.log("→ opening exchange_sync_runs row…");
const { data: run } = await sb
  .from("exchange_sync_runs")
  .insert({
    user_id: conn.user_id,
    connection_id: conn.id,
    exchange: conn.exchange,
    environment: conn.environment,
    category: "linear",
    status: "running",
    window_start: new Date(startMs).toISOString(),
    window_end: new Date(nowMs).toISOString(),
  })
  .select("id")
  .single();
const syncRunId = run!.id;
console.log("  id:", syncRunId);

console.log("→ fetching closed-pnl…");
const closedPnlRaw = await pagedGet(
  apiKey,
  apiSecret,
  baseUrl,
  "/v5/position/closed-pnl",
  { category: "linear", startTime: startMs, endTime: nowMs, limit: 100 },
);
console.log(`  ${closedPnlRaw.length} rows`);

console.log("→ fetching executions…");
const execsRaw = await pagedGet(
  apiKey,
  apiSecret,
  baseUrl,
  "/v5/execution/list",
  { category: "linear", startTime: startMs, endTime: nowMs, limit: 100 },
);
console.log(`  ${execsRaw.length} rows`);

let imported = 0;
let skipped = 0;

if (closedPnlRaw.length > 0) {
  console.log("→ upserting closed-pnl rows…");
  type Raw = Record<string, unknown>;
  const rows = closedPnlRaw.map((r) => {
    const x = r as Raw;
    return {
      user_id: conn.user_id,
      connection_id: conn.id,
      sync_run_id: syncRunId,
      exchange: "bybit",
      environment: conn.environment,
      category: "linear",
      exchange_order_id: String(x.orderId ?? ""),
      symbol: String(x.symbol ?? ""),
      side: x.side === "Sell" ? "Sell" : "Buy",
      qty: num(x.qty),
      closed_size: num(x.closedSize),
      avg_entry_price: num(x.avgEntryPrice),
      avg_exit_price: num(x.avgExitPrice),
      closed_pnl: num(x.closedPnl),
      open_fee: num(x.openFee),
      close_fee: num(x.closeFee),
      leverage: num(x.leverage),
      order_type: str(x.orderType),
      exec_type: str(x.execType),
      opened_at: msToIso(x.createdTime ?? x.updatedTime),
      closed_at: msToIso(x.updatedTime ?? x.createdTime),
      raw_payload: x,
      import_status: "pending",
    };
  });
  const { data, error } = await sb
    .from("exchange_closed_pnl")
    .upsert(rows, {
      onConflict: "connection_id,exchange,category,exchange_order_id,closed_at,closed_size,closed_pnl",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) {
    console.error("  ✗", error);
  } else {
    const n = data?.length ?? 0;
    imported += n;
    skipped += rows.length - n;
    console.log(`  ${n} new / ${rows.length - n} dupes`);
  }
}

if (execsRaw.length > 0) {
  console.log("→ upserting fills…");
  type Raw = Record<string, unknown>;
  const rows = execsRaw.map((r) => {
    const x = r as Raw;
    return {
      user_id: conn.user_id,
      connection_id: conn.id,
      sync_run_id: syncRunId,
      exchange: "bybit",
      environment: conn.environment,
      category: "linear",
      exchange_order_id: String(x.orderId ?? ""),
      exchange_fill_id: String(x.execId ?? ""),
      symbol: String(x.symbol ?? ""),
      side: x.side === "Sell" ? "Sell" : "Buy",
      order_price: num(x.orderPrice),
      order_qty: num(x.orderQty),
      exec_price: num(x.execPrice),
      exec_qty: num(x.execQty),
      exec_value: num(x.execValue),
      exec_fee: num(x.execFee),
      fee_currency: str(x.feeCurrency),
      fee_rate: num(x.feeRate),
      exec_type: str(x.execType),
      is_maker: Boolean(x.isMaker),
      seq: x.seq != null && x.seq !== "" ? String(x.seq) : null,
      executed_at: msToIso(x.execTime),
      raw_payload: x,
    };
  });
  const { data, error } = await sb
    .from("exchange_fills")
    .upsert(rows, {
      onConflict: "connection_id,exchange,category,exchange_fill_id",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) {
    console.error("  ✗", error);
  } else {
    const n = data?.length ?? 0;
    imported += n;
    skipped += rows.length - n;
    console.log(`  ${n} new / ${rows.length - n} dupes`);
  }
}

console.log("→ finalising sync run…");
await sb.from("exchange_sync_runs").update({
  status: "success",
  finished_at: new Date().toISOString(),
  imported_count: imported,
  skipped_count: skipped,
}).eq("id", syncRunId);

await sb.from("exchange_connections").update({
  last_sync_at: new Date().toISOString(),
  last_error: null,
  status: "active",
}).eq("id", conn.id);

console.log(`\n✓ SYNC COMPLETE — ${imported} imported, ${skipped} skipped\n`);

const { data: pending } = await sb
  .from("exchange_closed_pnl")
  .select("id, symbol, side, closed_size, closed_pnl, closed_at, import_status")
  .eq("connection_id", conn.id)
  .eq("import_status", "pending")
  .order("closed_at", { ascending: false })
  .limit(10);

console.log(`Pending closed-PnL rows on this connection: ${pending?.length ?? 0}`);
if (pending && pending.length > 0) {
  console.table(pending);
}
