# EA ingest — replay-protection protocol (v2)

**Status:** SHIPPED (server side). Migrations 0041 + 0042 applied; v2 accepted at `/api/ea/ingest`. MT5 EA-side change tracked separately (still needs to be released).
**Owner:** journal/`web/app/api/ea/ingest`
**Implementation:** `web/lib/ea/sig.ts`, `web/lib/ea/secrets.ts`, `web/app/api/ea/ingest/route.ts`, `web/lib/actions/ea-tokens.ts`

---

## 1. Goals & non-goals

### Goals
- Reject **replays** of captured request bodies even when the bearer token is still valid.
- Reject requests with **stale or future-dated** timestamps (≥ ±5 min from server clock).
- Reject **forged bodies** (i.e. detect tampering after a request was captured) when a per-token signing secret is in use.
- Stay **backward compatible** with currently-deployed MT5 EAs for a 30-day migration window.
- Keep ingest **idempotent** for the same `(user_id, ticket)` so legitimate retries still succeed.

### Non-goals
- We are not building a full mutual-TLS or asymmetric-signature scheme. Symmetric HMAC is sufficient against the realistic threats below.
- We are not solving "the user's EA host is fully compromised." If the attacker has continuous read on the MT5 process, they have both the bearer token and the signing secret, and rate limiting is the only remaining lever (already in place at 60/min per token).

### Threat model
| Threat | Today | After v2 |
|---|---|---|
| Token leak (file exfil) → attacker forges any new trade | Rate-limited only | Still possible — same secret material grants forge ability if both bearer + signing secret leak together. Signing helps only if they leak separately (rare on MT5). |
| Request capture (MITM with bad TLS, log file scrape) → attacker replays same body | Harmless for same ticket (idempotent), but extra `abuse_log` noise; forge-with-new-ticket possible if attacker also captures fresh nonces | **Replay rejected by nonce table; forge-new-ticket requires capturing recent nonces AND signing key** |
| Stolen body replayed >60 min later | Allowed | **Rejected by stale-timestamp check** |
| Body tampering after capture (e.g. flip pnl sign) | Not detected | **HMAC mismatch → rejected** |

---

## 2. Wire protocol

### Versioning: header-based
```
POST /api/ea/ingest
Authorization: Bearer <raw-token>
X-Ingest-Protocol: v2
Content-Type: application/json
```

- Missing header → server treats as v1 (legacy mode). Server logs a deprecation warning with the token id.
- Header value `v2` → server enforces all v2 checks below.
- Any other value → 400 `{"error": "Unsupported protocol version"}`.

### v2 request body
```jsonc
{
  // Existing fields (unchanged) — see eaTradeSchema in web/lib/ea/normalize.ts
  "ticket": 1234567,
  "symbol": "EURUSD.m",
  "type": "buy",
  "lots": 0.1,
  "open_price": 1.0876,
  "open_time": "2026-05-17T12:00:00Z",
  // ... optional close_price, close_time, profit, swap, commission, magic, comment

  // NEW v2 envelope fields:
  "sent_at": "2026-05-17T12:00:03.142Z",     // ISO-8601 UTC, EA clock at send time
  "nonce":   "9d4f2c6b1a8e7053",              // 16 random bytes, hex (32 chars)
  "sig":     "b3c1...e89"                     // HMAC-SHA256 hex (64 chars), see §3
}
```

### v2 response
- `200 { ok: true }` — accepted (unchanged)
- `400 { error: "Invalid trade payload" }` — zod fail (unchanged) OR malformed v2 envelope
- `401 { error: "Invalid or revoked token" }` — bearer rejected (unchanged)
- `401 { error: "Invalid signature" }` — HMAC mismatch (NEW)
- `409 { error: "Replayed request" }` — nonce reuse (NEW)
- `409 { error: "Stale request" }` — timestamp outside ±5 min window (NEW)
- `413 { error: "Payload too large" }` — body > 32 KB (unchanged)
- `429 { error: "Too many requests" }` — per-token rate limit hit (unchanged)
- `503 { error: "Ingest temporarily unavailable" }` — abuse_log or nonce table infrastructure failure (existing 503 + new 503 reasons)

Always-generic error strings; no internal details leak.

---

## 3. Signing algorithm

### Per-token signing secret
- On `generateEaTokenAction()`, generate **two** independent 32-byte random hex strings: the **bearer token** (`raw`, displayed once) and a **signing secret** (`raw_sig`, displayed once).
- The bearer is stored as `token_hash` (SHA-256, lookup key, existing).
- The signing secret is **encrypted at rest** via AES-256-GCM + HKDF, modeled on `web/lib/exchanges/crypto.ts`. Columns added in migration 0041: `signing_secret_ciphertext`, `signing_secret_iv`, `signing_secret_tag`, `signing_secret_key_version`. Implementation in `web/lib/ea/secrets.ts`.
- Master key env var: `EA_SIGNING_SECRET_ENCRYPTION_KEY` (base64-encoded ≥32 bytes; generate with `openssl rand -base64 32`). Distinct from `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` so the two key custodies stay independent.
- HKDF info is bound to `(user_id, token_id)` so even an attacker with the master key + a single ciphertext row can't replay it under a different token id.
- `signing_secret_key_version` is recorded so future master-key rotation can read old rows while encrypting new ones with a v2 key.

### Canonical signing message
```
v2\n
<bearer-token-id-uuid>\n
<sent_at>\n
<nonce>\n
<sha256-hex-of-canonical-trade-fields>
```

### Canonical trade-fields hash (shipped)
The canonical trade-fields hash is **NOT** `JSON.stringify`. We deliberately
avoid JSON canonicalization so the MQL5 EA doesn't need a JSON canonicalizer
library. Instead:

1. Iterate this **fixed field list** in this **exact order**:
   ```
   ticket, symbol, type, lots, open_price, close_price, open_time,
   close_time, profit, swap, commission, magic, comment
   ```
2. For each field, build a line `<field-name>=<value>` where the value is:
   - empty string `""` if the field is absent / `null` / `undefined`
   - `String(n)` for numbers (uses JavaScript's shortest round-trip
     representation, e.g. `1.0876`, `0.1`, `-12.5`). MQL5 must emit the
     **exact shortest decimal representation matching JavaScript
     `String(n)`** — do NOT use `DoubleToString(value, 0)` (rounds to
     zero decimal places) or `DoubleToString(value, 8)` (always emits
     8 decimals incl. trailing zeros). Implement a small helper that
     trims trailing zeros and the trailing `.` and verify the MQL5
     output against the golden vectors in `web/tests/ea-sig.spec.ts`
     for at least: integers (`123`), tight fractionals (`1.0876`),
     small numbers (`0.1`), negatives (`-12.5`), and whole-number
     prices (`2300`).
   - the string itself for strings
3. Join the 13 lines with `\n` (no trailing newline).
4. `tradeHash = lowercase(hex(sha256(joined)))`.

The full signing message is then the five lines above joined with `\n`.
`sig = lowercase(hex(hmac_sha256(signing_secret, message)))`.

Server-side compare is constant-time via `crypto.timingSafeEqual` after a
length pre-check. Case-insensitive compare is achieved by lowercasing both
sides before the hex→Buffer conversion.

Reference implementation: `web/lib/ea/sig.ts` (`TRADE_FIELD_ORDER`,
`tradeFieldsHash`, `canonicalMessage`, `signMessage`, `verifySig`).
Golden tests in `web/tests/ea-sig.spec.ts` lock in the byte-for-byte
output for a fixed input — port these vectors to MQL5 to verify the EA
produces identical signatures.

### Why include the bearer-token-id, not the raw token, in the message
- The bearer is in the `Authorization` header, not the body, so signing it would let an attacker who captures the body alone replay against any token. Binding to the **token id** (UUID returned from `ea_tokens.id`) means the EA must know its own row id, which the server can look up from the bearer at sign-verification time.
- Avoids putting the raw bearer in the body where it could be logged.

---

## 4. Server-side validation flow

```
1. Parse Authorization, look up ea_tokens row (existing)
2. Read raw body under 32 KB cap (existing)
3. JSON.parse (existing)
4. If X-Ingest-Protocol == "v2":
     a. Parse envelope: sent_at, nonce, sig must all be present and well-formed
        - sent_at: valid ISO, within ±300s of NOW(). If outside → 409 stale.
        - nonce:   /^[0-9a-f]{32}$/. If malformed → 400.
        - sig:     /^[0-9a-f]{64}$/. If malformed → 400.
     b. Recompute canonical message + HMAC using ea_tokens.signing_secret.
        Constant-time compare. Mismatch → 401 invalid signature.
     c. Try INSERT into ea_request_nonces (token_hash, nonce, sent_at).
        Primary key (token_hash, nonce) → duplicate fails with unique-violation.
        Duplicate → 409 replayed. Other errors → 503.
   Else (v1, no header):
     a. Log deprecation warning once per token-id per process restart.
     b. Skip nonce + sig checks.
     c. After v1 cutover date (env flag, see §6), return 410 Gone instead.
5. zod-parse the trade fields (existing eaTradeSchema)
6. Per-token rate limit via abuse_log (existing, applies to BOTH v1 and v2)
7. Upsert trade, recalc score (existing)
```

Step 4b happens before step 5 so we don't burn a nonce on payloads that fail validation later — actually scratch that. **Nonce insert must happen LAST, after all validation passes but BEFORE the trade upsert.** Otherwise a legitimate EA sending a malformed payload gets its nonce burnt and can't retry with a fix.

Corrected order: 4a → 4b → 5 → 6 → 4c → 7.

(If step 7 fails, the nonce is already consumed; the EA must regenerate. This is correct: the EA should treat 5xx as "try again with a fresh nonce.")

---

## 5. Storage

### Existing table changes — `0041_ea_tokens_signing_secret.sql` (shipped)
Adds nullable columns:
- `signing_secret_ciphertext text` — base64 AES-256-GCM ciphertext
- `signing_secret_iv text` — base64 12-byte IV
- `signing_secret_tag text` — base64 16-byte GCM auth tag
- `signing_secret_key_version integer` — master-key version, currently `1`

Legacy tokens (pre-0041) have NULL for all four. The route returns `401 Invalid signature` on v2 requests against legacy tokens — bailing BEFORE attempting decryption — and `/ea-setup` shows a yellow "Legacy — regenerate for v2 replay protection" badge on the token row.

### New nonce table
```sql
-- migration 0042_ea_request_nonces.sql
create table if not exists public.ea_request_nonces (
  token_hash text not null,
  nonce      text not null,
  sent_at    timestamptz not null,
  seen_at    timestamptz not null default now(),
  primary key (token_hash, nonce)
);

-- Prune index — supports the cleanup function and bounded growth
create index if not exists ea_request_nonces_seen_at_idx
  on public.ea_request_nonces (seen_at);

alter table public.ea_request_nonces enable row level security;
-- service-role only, like abuse_log; no policies

create or replace function public.cleanup_ea_request_nonces(
  p_older_than interval default interval '10 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare deleted_count integer;
begin
  delete from public.ea_request_nonces where seen_at < now() - p_older_than;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function public.cleanup_ea_request_nonces(interval) from public;
```

### Why NOT reuse `abuse_log`
- `abuse_log` is append-only with no uniqueness constraint. Replay check needs INSERT-on-conflict-rejects.
- Different lifecycle: nonces TTL out at 10 min; abuse_log entries stick around for 7 days.
- Different access pattern: nonces are looked up by exact `(token_hash, nonce)` key; abuse_log is range-scanned.
- A separate table keeps the schemas semantically distinct and makes pruning trivial.

---

## 6. Backward compatibility & cutover plan

| Phase | Server | EA | Trigger |
|---|---|---|---|
| T0 | Deploy v2. Both v1 (no header) and v2 requests accepted. v1 gets deprecation warning logged with token id. | unchanged | — |
| T0 + 14 days | Same. Add a banner on `/ea-setup` for any user whose tokens have all-NULL `signing_secret` (i.e. legacy tokens). | Ship EA update v2.0 that sends `X-Ingest-Protocol: v2` + envelope fields. | EA release |
| T0 + 30 days | If env flag `EA_INGEST_V1_CUTOFF_AT` is set and `NOW() > flag`, v1 requests return `410 Gone` with body `{"error": "EA out of date — regenerate your token and update the EA in MT5"}`. | All active users should be on v2 EA. | env flag flip |
| T0 + 30 days +1 | Optional: drop `signing_secret IS NULL` rows from `ea_tokens` after a notification email — forces regen. | n/a | manual |

### Per-token migration
- Existing tokens have `signing_secret = NULL`. They keep working in v1 mode until cutover.
- Regenerating a token (existing flow) gets a new `signing_secret` and the user must update their MT5 config with the **token UUID**, the **bearer**, and the **signing secret** — all three are needed for v2 signing.
- The `/ea-setup` UI shows all three **once** at generation time with the "you'll never see these again" warning. The **token UUID is also visible permanently** on each token's row in the list, so users who saved bearer + secret but not the UUID can still configure their EA without regenerating.

---

## 7. Test plan

### Unit tests — `web/tests/ea-sig.spec.ts` (new)
1. `canonicalMessage()` produces a stable string for a known payload (golden test).
2. `verifySig()` returns true for a valid HMAC.
3. `verifySig()` returns false for any single-bit-flipped signature.
4. `verifySig()` returns false when signing secret is wrong.
5. `verifySig()` is constant-time (call `crypto.timingSafeEqual` — implicit via the helper).

### Integration tests — `web/tests/ea-ingest-v2.spec.ts` (new, exercises the route handler with a mocked Supabase client)
1. **Valid v2 request** → 200, trade inserted, nonce row inserted.
2. **Stale timestamp** (`sent_at` 6 min in past) → 409 stale, no DB writes.
3. **Future timestamp** (`sent_at` 6 min in future) → 409 stale.
4. **Clock-skew boundary** — `sent_at` exactly 4m59s in past → 200; 5m01s in past → 409.
5. **Replayed nonce** (second request with same `(token, nonce)`) → 409 replayed, no double-insert.
6. **Bad signature** (one hex char flipped) → 401 invalid signature.
7. **Missing field** (no `nonce`) → 400.
8. **Malformed nonce** (`nonce: "not-hex"`) → 400.
9. **Malformed sig** (52 chars instead of 64) → 400.
10. **v1 request after cutover flag** → 410 gone.
11. **v1 request before cutover** → 200 (existing v1 behavior preserved) + deprecation warning logged.
12. **Signing secret NULL on token** + v2 request → 401 (can't HMAC-verify without the secret).

### Manual smoke
- Generate a fresh token in `/ea-setup`, copy both bearer + signing secret.
- Use a Postman or curl snippet (committed under `websocket-server/scripts/sign-ea-payload.sh` or similar) to POST a signed v2 payload. Verify 200, then re-POST same body → 409 replayed.

---

## 8. Decisions baked into the shipped implementation

Codex's review settled the open questions:

1. **Encrypted-at-rest with envelope encryption** — implemented in `web/lib/ea/secrets.ts` mirroring the exchange-credential pattern. Separate env var: `EA_SIGNING_SECRET_ENCRYPTION_KEY`.
2. **±5 min timestamp window** — `TIMESTAMP_WINDOW_MS` in `web/lib/ea/sig.ts`.
3. **Soft cutover via `EA_INGEST_V1_CUTOFF_AT` env flag.** If unset, v1 is allowed (with a clear server warning, gated per token id) so a missing env var can't accidentally brick existing users. Once set and past, v1 returns `410 Gone`.
4. **Cleanup function shipped but not cron-wired** — the table is bounded (10-min TTL × peak ~60 req/min/token); `cleanup_ea_request_nonces()` is callable manually or by a future cron.
5. **Header:** `X-Ingest-Protocol: v2`.

---

## 9. Shipped implementation

| Order | Component | File |
|---|---|---|
| 1 | Migration: signing-secret columns on `ea_tokens` | `supabase/migrations/0041_ea_tokens_signing_secret.sql` |
| 2 | Migration: replay-nonce table | `supabase/migrations/0042_ea_request_nonces.sql` |
| 3 | Crypto helper (AES-256-GCM + HKDF) | `web/lib/ea/secrets.ts` |
| 4 | Canonicalization + HMAC + envelope rules | `web/lib/ea/sig.ts` |
| 5 | Token gen action returns `{ rawToken, signingSecret, id }` | `web/lib/actions/ea-tokens.ts` |
| 6 | Route handler: protocol-version branch, v2 validation pipeline, atomic nonce insert, soft cutover | `web/app/api/ea/ingest/route.ts` |
| 7 | UI: show signing secret once + "Legacy" badge on legacy rows | `web/app/(app)/ea-setup/EaTokenManager.tsx`, `web/app/(app)/ea-setup/page.tsx` |
| 8 | Tests (32 new): canonicalization, HMAC, encryption round-trip, integration | `web/tests/ea-sig.spec.ts`, `web/tests/ea-secrets.spec.ts`, `web/tests/ea-ingest-v2.spec.ts` |

### Still to ship
- **MT5 EA update (MQL5 under `mql5/`)** — needs to compute HMAC-SHA256 over the canonical message, send `X-Ingest-Protocol: v2`, generate a fresh 16-byte random nonce per send, and stop trying to retry the same body when the server returns 409 (the nonce is burnt; regenerate).
- **Set `EA_SIGNING_SECRET_ENCRYPTION_KEY`** in Vercel (Production + Preview) on the `big-markt-trade-journal` project. `openssl rand -base64 32` and paste. The action will fail with a clear error if it's missing.
- **Apply migrations 0041 + 0042** in Supabase.
- **Optional:** set `EA_INGEST_V1_CUTOFF_AT` to enforce the v1 sunset on a chosen date (suggest T + 30 days after the MT5 EA update ships).
- **Optional:** wire `cleanup_ea_request_nonces()` into the existing Vercel cron alongside `cleanup_abuse_log()`.
