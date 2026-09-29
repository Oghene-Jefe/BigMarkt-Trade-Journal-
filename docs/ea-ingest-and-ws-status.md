# EA ingest and WebSocket status

The MT5 EA uses two separate production paths:

- Trade/state ingest: `POST https://journal.bigmarkt.co/api/ea/ingest`
- Presence/status: WebSocket connection to the Railway service plus the
  server-to-server `GET /status` endpoint

The WebSocket server is not a trade ingestion surface. If an EA sends a
WebSocket `trade` frame, the server returns `trade_ingest_disabled` and points
the client at `/api/ea/ingest`.

## EA file versions

- `web/public/downloads/BigMarkt_EA_v2.7.1.mq5` is the EA file served by the
  journal's `/ea-setup` wizard. It includes the `open_snapshot` full mirror
  event.
- `mql5/BigMarkt_EA.mq5` is an older source copy currently declaring v2.5.1. Do
  not use it as the production download source unless it is intentionally
  brought forward.

## HTTP ingest auth

Every request authenticates with the raw EA bearer token:

```http
Authorization: Bearer <raw-token>
```

The server hashes the bearer token with SHA-256 and looks up an active,
non-revoked row in `ea_tokens`. Token generation happens in `/ea-setup` and is
linked to a broker account.

## v2 signed envelope

New EA requests send:

```http
X-Ingest-Protocol: v2
```

The JSON body must include:

- `sent_at`: ISO timestamp inside the freshness window.
- `nonce`: 32-64 hex characters, unique per token.
- `sig`: 64-character HMAC-SHA256 hex signature.
- `field_hash`: SHA-256 of the event's canonical field bundle.

The server decrypts the per-token signing secret using
`EA_SIGNING_SECRET_ENCRYPTION_KEY`, verifies the HMAC, and records the nonce so
replays fail. Legacy tokens without an encrypted signing secret cannot use v2.

The HMAC message is newline-separated:

```text
v2
<token UUID>
<sent_at>
<nonce>
<field_hash>
```

Canonical field hashing is implemented in `web/lib/ea/sig.ts` and mirrored in
the EA. Adding or reordering signed fields is a wire-protocol change.

## Event types

Supported v2 payloads:

- Deal payloads for market fills.
- Order events: `order_add`, `order_update`, `order_delete`.
- `position_modify` for live SL/TP changes.
- `open_snapshot` for v2.7.1 full open-state reconciliation.

`open_snapshot` sends the complete set of currently open positions and the live
pending order tickets. The server uses it to reopen missing positions, insert
new live positions, repair lots/SL/TP drift, close local orphans, and cancel
stale pending rows. Empty `positions: []` is valid when the terminal has no open
positions.

Unsigned account snapshot fields (`account_balance`, `account_equity`,
`account_currency`, and `backfill`) are accepted as passthrough metadata and are
not part of any field hash.

## v1 legacy behavior

Requests without `X-Ingest-Protocol: v2` follow the legacy v1 path while allowed
by `EA_INGEST_V1_CUTOFF_AT`.

- If `EA_INGEST_V1_CUTOFF_AT` is unset, v1 is accepted and a throttled
  deprecation warning is logged.
- If the cutoff is set and has passed, v1 returns `410`.

## WebSocket status contract

The Railway service authenticates EA WebSocket connections with the same bearer
token lookup and tracks live sockets in memory.

The journal server polls:

```http
GET <WS_STATUS_URL>?token_ids=<comma-separated-token-uuids>
Authorization: Bearer <WS_STATUS_SECRET>
```

The status response is scoped by both controls:

- `WS_STATUS_SECRET` authorizes the server-to-server status request.
- `token_ids` is an allow-list. The WebSocket server filters its connection map
  before responding and never returns the global connection map.

No `token_ids` means an empty allow-list and therefore zero returned
connections, even with the correct secret.

## Required environment

Journal/Vercel:

- `SUPABASE_SERVICE_ROLE_KEY`
- `EA_SIGNING_SECRET_ENCRYPTION_KEY`
- `WS_STATUS_URL`
- `WS_STATUS_SECRET`
- optional `EA_INGEST_V1_CUTOFF_AT`

WebSocket/Railway:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WS_STATUS_SECRET`
