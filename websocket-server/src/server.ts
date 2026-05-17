import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";
import type { TradePayload } from "./types.js";
import { parseTokenIds } from "./statusQuery.js";

export type { TradePayload };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Railway injects PORT. WS_PORT is the local-dev fallback.
const PORT = Number(process.env.PORT ?? process.env.WS_PORT ?? 8080);

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

  let accountType: string | null = null;
  if (socket.tokenId) {
    const { data: tokenData } = await supabase
      .from("ea_tokens")
      .select("broker_account_id")
      .eq("id", socket.tokenId)
      .maybeSingle();
    const brokerAccountId = (tokenData?.broker_account_id as string | null) ?? null;
    if (brokerAccountId) {
      const { data: account } = await supabase
        .from("broker_accounts")
        .select("account_type")
        .eq("id", brokerAccountId)
        .maybeSingle();
      accountType = (account?.account_type as string | null) ?? null;
    }
  }
  const trustBadge = accountType === "demo" ? "demo" : "auto_verified";

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
    trust_badge: trustBadge,
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

// ── Single HTTP server: handles /status + /healthz, and WS upgrades ─────────
const httpServer = createHttpServer((req, res) => {
  const rawUrl = req.url ?? "";
  const [path, query = ""] = rawUrl.split("?");

  if (req.method === "GET" && path === "/status") {
    // Defense in depth:
    //   1. WS_STATUS_SECRET gate — only the journal server can call.
    //   2. The journal MUST supply ?token_ids=… listing the calling
    //      user's active EA tokens. We filter `authedSockets` to that
    //      allow-list before building the response.
    // Result: the server never returns the global active-connection map,
    // not even to the journal. A caller with the secret but no token_ids
    // gets back zero connections — secure default.
    const statusSecret = process.env.WS_STATUS_SECRET;
    if (!statusSecret) {
      console.error("WS_STATUS_SECRET is not set — refusing /status");
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Status endpoint not configured" }));
      return;
    }
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${statusSecret}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // Parse `?token_ids=uuid1,uuid2`. Junk inputs (non-UUID, empty
    // entries) are silently dropped by parseTokenIds; missing param →
    // empty allow-list → zero connections returned.
    const params = new URLSearchParams(query);
    const allowList = new Set(parseTokenIds(params.get("token_ids")));

    const now = Date.now();
    const connections = allowList.size === 0
      ? []
      : Array.from(authedSockets)
          .filter((s) => s.tokenId && allowList.has(s.tokenId))
          .map((s) => {
            const lastPing = s.lastPing ?? now;
            const ago = now - lastPing;
            const entry: {
              token_id: string;
              last_ping_ms_ago: number;
              stale?: boolean;
            } = {
              token_id: s.tokenId ?? "",
              last_ping_ms_ago: ago,
            };
            if (ago > STALE_MS) entry.stale = true;
            return entry;
          });
    const body = JSON.stringify({
      // connected_clients now reflects only what's visible to the caller,
      // never the global tally. Server uptime + timestamp remain because
      // they aren't sensitive and the EA-setup UI uses them.
      connected_clients: connections.length,
      server_uptime_seconds: Math.floor(process.uptime()),
      ts: now,
      connections,
    });
    // No CORS header — this is a server-to-server endpoint, not for
    // browser fetches. Removing it discourages anyone from re-introducing
    // a client-side caller.
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(body);
    return;
  }

  if (req.method === "GET" && path === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

// Attach WebSocket server to the HTTP server — no separate port needed.
const wss = new WebSocketServer({ server: httpServer });

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

httpServer.listen(PORT, () => {
  console.log(`BigMarkt WebSocket + status server listening on :${PORT}`);
});
