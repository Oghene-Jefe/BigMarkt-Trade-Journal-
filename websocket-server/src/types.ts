// Reserved for future WS message types. The previous `TradePayload`
// interface was used by the now-decommissioned trade-ingest path
// (see docs/ea-ingest-and-ws-status.md).
// Trade ingest is HTTP-only — see web/lib/ea/normalize.ts for the
// authoritative shape, validated server-side by `eaTradeSchema`.
export {};
