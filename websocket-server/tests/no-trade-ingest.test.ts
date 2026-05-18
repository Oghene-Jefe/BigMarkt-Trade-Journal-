// Regression test for the WS trade-ingest decommission.
//
// Closes audit findings C-2 + C-3 in docs/security-audit-2026-05-17.md.
// Codex approval: docs/codex-ws-decision-approval.md.
//
// `handleClientMessage` is a pure function that has no Supabase client
// available to it — so by construction the WS `trade` message path cannot
// write a `trades` row. This spec proves the visible contract:
//   • `trade` frame → `trade_ingest_disabled` error pointing at HTTP
//   • `ping` frame → `pong` (presence path unchanged)
//   • unknown frame → generic error
//   • malformed JSON → "invalid JSON" error
//
// Test runner is Node's built-in (`node:test`) driven by tsx, matching
// the package.json `test` script (`tsx --test tests/*.test.ts`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleClientMessage, type SocketLike } from "../src/server.js";

function mockSocket(): { sent: string[]; socket: SocketLike } {
  const sent: string[] = [];
  const socket: SocketLike = {
    send: (m: string) => {
      sent.push(m);
    },
  };
  return { sent, socket };
}

test("WS 'trade' message returns trade_ingest_disabled error and never reaches a DB write", () => {
  const { sent, socket } = mockSocket();
  handleClientMessage(
    socket,
    JSON.stringify({
      type: "trade",
      payload: {
        ticket: 1,
        symbol: "EURUSD",
        type: "buy",
        lots: 0.01,
        open_price: 1.1,
        open_time: "2026-05-18T00:00:00.000Z",
        profit: 999_999,
      },
    }),
  );

  assert.equal(sent.length, 1, "expected exactly one response frame");
  const reply = JSON.parse(sent[0]);
  assert.equal(reply.type, "error");
  assert.equal(reply.code, "trade_ingest_disabled");
  assert.match(
    reply.message,
    /\/api\/ea\/ingest/,
    "rejection message must point clients at the HTTP endpoint",
  );
});

test("forged-PnL 'trade' frame is rejected the same way as a normal one (no special-case)", () => {
  const { sent, socket } = mockSocket();
  handleClientMessage(
    socket,
    JSON.stringify({
      type: "trade",
      payload: { ticket: 42, symbol: "GBPJPY", type: "sell", lots: 100, profit: 1e9 },
    }),
  );
  assert.equal(sent.length, 1);
  const reply = JSON.parse(sent[0]);
  assert.equal(reply.code, "trade_ingest_disabled");
});

test("WS 'trade' frame with no payload is still rejected as trade_ingest_disabled (uniform shape)", () => {
  const { sent, socket } = mockSocket();
  handleClientMessage(socket, JSON.stringify({ type: "trade" }));
  assert.equal(sent.length, 1);
  const reply = JSON.parse(sent[0]);
  assert.equal(reply.code, "trade_ingest_disabled");
});

test("WS 'ping' frame still returns pong (presence channel unchanged)", () => {
  const { sent, socket } = mockSocket();
  handleClientMessage(socket, JSON.stringify({ type: "ping" }));
  assert.equal(sent.length, 1);
  const reply = JSON.parse(sent[0]);
  assert.equal(reply.type, "pong");
  assert.equal(typeof reply.ts, "number");
});

test("WS 'ping' frame updates socket.lastPing", () => {
  const { socket } = mockSocket();
  const before = socket.lastPing ?? 0;
  handleClientMessage(socket, JSON.stringify({ type: "ping" }));
  assert.ok((socket.lastPing ?? 0) >= before, "lastPing must be set after a ping");
});

test("Unknown message type returns a generic error", () => {
  const { sent, socket } = mockSocket();
  handleClientMessage(socket, JSON.stringify({ type: "spaghetti" }));
  assert.equal(sent.length, 1);
  const reply = JSON.parse(sent[0]);
  assert.equal(reply.type, "error");
  assert.equal(reply.message, "unknown message type");
});

test("Malformed JSON returns the 'invalid JSON' error", () => {
  const { sent, socket } = mockSocket();
  handleClientMessage(socket, "{not json");
  assert.equal(sent.length, 1);
  const reply = JSON.parse(sent[0]);
  assert.equal(reply.type, "error");
  assert.equal(reply.message, "invalid JSON");
});

test("Empty body returns the 'invalid JSON' error (not a crash)", () => {
  const { sent, socket } = mockSocket();
  handleClientMessage(socket, "");
  assert.equal(sent.length, 1);
  const reply = JSON.parse(sent[0]);
  assert.equal(reply.message, "invalid JSON");
});
