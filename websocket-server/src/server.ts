import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { pathToFileURL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";
import { parseTokenIds } from "./statusQuery.js";

// ── WebSocket trade-ingest decommissioned ────────────────────────────────────
//
// This server used to accept `{type:"trade"}` frames from authenticated
// clients and upsert them directly into `trades`. That path was a parallel
// trade-ingest transport with NONE of the v2 protections that
// `/api/ea/ingest` has: signing-secret separation, HMAC, freshness window,
// nonce replay protection, zod bounds, broker-account scoping, or score
// recalculation.
//
// Decision: docs/claude-websocket-protocol-decision.md (Option A, codex-
// approved in docs/codex-ws-decision-approval.md). Closes audit findings
// C-2 + C-3 from docs/security-audit-2026-05-17.md. The official EA
// already POSTs trades to `/api/ea/ingest` over HTTP (verified in
// `mql5/BigMarkt_EA.mq5` — `ApiEndpoint` input + `WebRequest` call). No
// production user of the WS ingest path exists.
//
// Removed: handleTrade(), deriveDirection(), deriveResult(), TradePayload
// type. WS ingest now responds with a `trade_ingest_disabled` error that
// points clients at the HTTP endpoint.
//
// What stayed: auth handshake, ping/pong presence, ea_connection_log,
// /status (token_ids allow-list), /healthz. The WS server is now a
// presence/status surface only.
//
// If a future copy-execution feature (Session 13+) requires WS-based
// transport again, reintroduce it with the full v2 envelope from day 1
// — do NOT restore the bearer-only path.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Railway injects PORT. WS_PORT is the local-dev fallback.
const PORT = Number(process.env.PORT ?? process.env.WS_PORT ?? 8080);
const isMainModule = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isMainModule && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return supabase;
}

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

async function authenticate(rawToken: string): Promise<{ userId: string; tokenId: string } | null> {
  const hash = hashToken(rawToken);
  const { data, error } = await requireSupabase()
    .from("ea_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .single();

  if (error || !data) return null;
  return { userId: data.user_id as string, tokenId: data.id as string };
}

// ── Message handler ─────────────────────────────────────────────────────────
//
// Exported as a pure function so the regression test can verify behaviour
// without spinning up a real server or talking to Supabase. The handler
// itself doesn't perform any DB writes — the only side-effect channel is
// `socket.send`, which proves no trade row can be written through the WS
// `trade` message path.

export type SocketLike = {
  send: (msg: string) => void;
  lastPing?: number;
};

export function handleClientMessage(socket: SocketLike, raw: string): void {
  let msg: { type?: string; payload?: unknown };
  try {
    msg = JSON.parse(raw);
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
      // Audit C-2 + C-3. Trade ingest is HTTP-only — every accepted
      // payload must go through the v2 envelope at /api/ea/ingest.
      socket.send(
        JSON.stringify({
          type: "error",
          code: "trade_ingest_disabled",
          message:
            "Trade ingest moved to HTTP. POST to /api/ea/ingest with the v2 envelope. " +
            "See https://journal.bigmarkt.co/ea-setup for setup instructions.",
        }),
      );
      return;
    default:
      socket.send(JSON.stringify({ type: "error", message: "unknown message type" }));
  }
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

  const db = requireSupabase();

  await db
    .from("ea_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", auth.tokenId);

  try {
    const ip = req.socket.remoteAddress ?? null;
    await db.from("ea_connection_log").insert({
      user_id: auth.userId,
      token_id: auth.tokenId,
      event: "connected",
      ip,
    });
  } catch (err) {
    console.error("ea_connection_log connect insert failed:", err);
  }

  console.log(`WS connected: user=${auth.userId} token=${auth.tokenId}`);

  socket.on("message", (raw) => {
    handleClientMessage(socket, raw.toString());
  });

  socket.on("close", () => {
    authedSockets.delete(socket);
    console.log(`WS disconnected: user=${socket.userId ?? "unknown"}`);
    if (socket.userId && socket.tokenId) {
      void db
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

if (isMainModule) {
  httpServer.listen(PORT, () => {
    console.log(`BigMarkt WebSocket + status server listening on :${PORT}`);
  });
}
