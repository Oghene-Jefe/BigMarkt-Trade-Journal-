// Reserved for future WS message types. The previous `TradePayload`
// interface was used by the now-decommissioned trade-ingest path
// (see docs/claude-websocket-protocol-decision.md, codex-approved Option A).
// Trade ingest is HTTP-only — see web/lib/ea/normalize.ts for the
// authoritative shape, validated server-side by `eaTradeSchema`.
export {};
