import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";
import type { TradePayload } from "./types.js";

export type { TradePayload };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WS_PORT = Number(process.env.WS_PORT ?? 8080);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface AuthedSocket extends WebSocket {
  userId?: string;
  tokenId?: string;
  lastPing?: number;
}

const STALE_MS = 60_000;

const authedSockets = new Set<AuthedSocket>();

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function deriveDirection(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("buy")) return "long";
  if (t.includes("sell")) return "short";
  return t;
}

function deriveResult(
  pnl: number | null | undefined,
  closePrice: number | null | undefined,
  closeTime: string | null | undefined
): "win" | "loss" | "breakeven" | "open" {
  if (closePrice === null || closePrice === undefined) return "open";
  if (closeTime === null || closeTime === undefined || closeTime === "") return "open";
  if (pnl === undefined || pnl === null || pnl === 0) return "breakeven";
  return pnl > 0 ? "win" : "loss";
}

async function authenticate(rawToken: string): Promise<{ userId: string; tokenId: string } | null> {
  const hash = hashToken(rawToken);
  const { data, error } = await supabase
    .from("ea_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .single();

  if (error || !data) return null;
  return { userId: data.user_id as string, tokenId: data.id as string };
}

async function handleTrade(socket: AuthedSocket, payload: TradePayload): Promise<void> {
  if (!socket.userId) return;

  const pnl = payload.profit ?? null;

  const tradeRow = {
    user_id: socket.userId,
    ticket: payload.ticket,
    pair: payload.symbol,
    direction: deriveDirection(payload.type),
    lot_size: payload.lots,
    entry_price: payload.open_price,
    exit_price: payload.close_price ?? null,
    open_time: payload.open_time,
    close_time: payload.close_time ?? null,
    pnl,
    swap: payload.swap ?? null,
    commission: payload.commission ?? null,
    magic: payload.magic ?? null,
    comment: payload.comment ?? null,
    result: deriveResult(pnl, payload.close_price, payload.close_time),
    capture_source: "ea",
    trust_badge: "auto_verified",
    core_fields_locked: true,
    auto_approved: true,
  };

  const { error } = await supabase
    .from("trades")
    .upsert(tradeRow, { onConflict: "user_id,ticket" });

  if (error) {
    console.error("WS trade upsert error:", error);
    socket.send(
      JSON.stringify({
        type: "trade_ack",
        ticket: payload.ticket,
        status: "error",
        message: error.message,
      })
    );
    return;
  }

  socket.send(JSON.stringify({ type: "trade_ack", ticket: payload.ticket, status: "ok" }));
}

const wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", async (socket: AuthedSocket, req) => {
  const authHeader = req.headers["authorization"] ?? "";
  const raw = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!raw) {
    socket.close(4001, "Unauthorized");
    return;
  }

  const auth = await authenticate(raw);
  if (!auth) {
    socket.close(4001, "Unauthorized");
    return;
  }

  socket.userId = auth.userId;
  socket.tokenId = auth.tokenId;
  socket.lastPing = Date.now();
  authedSockets.add(socket);

  await supabase
    .from("ea_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", auth.tokenId);

  try {
    const ip = req.socket.remoteAddress ?? null;
    await supabase.from("ea_connection_log").insert({
      user_id: auth.userId,
      token_id: auth.tokenId,
      event: "connected",
      ip,
    });
  } catch (err) {
    console.error("ea_connection_log connect insert failed:", err);
  }

  console.log(`WS connected: user=${auth.userId} token=${auth.tokenId}`);

  socket.on("message", async (raw) => {
    let msg: { type?: string; payload?: TradePayload };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "invalid JSON" }));
      return;
    }

    switch (msg.type) {
      case "ping":
        socket.lastPing = Date.now();
        socket.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        return;
      case "trade":
        if (!msg.payload) {
          socket.send(JSON.stringify({ type: "error", message: "missing payload" }));
          return;
        }
        await handleTrade(socket, msg.payload);
        return;
      default:
        socket.send(JSON.stringify({ type: "error", message: "unknown message type" }));
    }
  });

  socket.on("close", () => {
    authedSockets.delete(socket);
    console.log(`WS disconnected: user=${socket.userId ?? "unknown"}`);
    if (socket.userId && socket.tokenId) {
      void supabase
        .from("ea_connection_log")
        .insert({
          user_id: socket.userId,
          token_id: socket.tokenId,
          event: "disconnected",
        })
        .then(({ error }) => {
          if (error) console.error("ea_connection_log disconnect insert failed:", error);
        });
    }
  });

  socket.on("error", (err) => {
    authedSockets.delete(socket);
    console.error(`WS error: user=${socket.userId ?? "unknown"}`, err);
  });
});

console.log(`BigMarkt WebSocket server listening on :${WS_PORT}`);

// ── HTTP status endpoint ─────────────────────────────────────────────────────
const statusPort = WS_PORT + 1;

try {
  const statusServer = createHttpServer((req, res) => {
    const url = (req.url ?? "").split("?")[0];

    if (req.method === "GET" && url === "/status") {
      const now = Date.now();
      const connections = Array.from(authedSockets).map((s) => {
        const lastPing = s.lastPing ?? now;
        const ago = now - lastPing;
        const entry: { token_id: string; last_ping_ms_ago: number; stale?: boolean } = {
          token_id: s.tokenId ?? "",
          last_ping_ms_ago: ago,
        };
        if (ago > STALE_MS) entry.stale = true;
        return entry;
      });
      const body = JSON.stringify({
        connected_clients: authedSockets.size,
        server_uptime_seconds: Math.floor(process.uptime()),
        ts: now,
        connections,
      });
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      });
      res.end(body);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  statusServer.on("error", (err) => {
    console.error(`Status server error on :${statusPort}:`, err);
  });

  // Bind explicitly to 0.0.0.0 so IPv4 clients (http://localhost:8081 → 127.0.0.1)
  // can reach it — defaulting can bind IPv6-only (::) on some Windows setups.
  statusServer.listen(statusPort, "0.0.0.0", () => {
    console.log(`BigMarkt status server listening on :${statusPort}`);
  });
} catch (err) {
  console.error("Failed to start status server:", err);
}
