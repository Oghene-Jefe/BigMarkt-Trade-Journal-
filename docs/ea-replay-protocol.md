# EA ingest — replay-protection protocol (v2)

**Status:** PROPOSAL — not yet implemented. Awaiting Codex sign-off.
**Owner:** journal/`web/app/api/ea/ingest`
**Related:** TODO at the bottom of `web/app/api/ea/ingest/route.ts`

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
- Store both: existing `token_hash` (sha256 of bearer) + new `signing_secret` column (plaintext, 64 hex chars).
- We must store `signing_secret` in plaintext because the server needs to recompute HMAC. The trade-off: a DB compromise (read of `ea_tokens`) leaks all signing secrets. We accept this because a service-role-key compromise already lets the attacker insert trades directly — adding "leaks signing secrets" doesn't widen that blast radius.

### Canonical signing message
```
v2\n
<bearer-token-id-uuid>\n
<sent_at>\n
<nonce>\n
<sha256-hex-of-canonical-trade-fields>
```
Where the canonical trade fields are: the JSON-serialized object containing only the existing `eaTradeSchema` fields, with keys in lexicographic order and no whitespace. (Pinning key order kills "tampering by reordering JSON" attacks and lets the EA and server agree on the bytes-to-hash.)

`sig = hex(hmac_sha256(signing_secret, message))` — case-insensitive compare server-side.

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

### Existing table changes
```sql
-- migration 0041_ea_tokens_signing_secret.sql
alter table public.ea_tokens
  add column if not exists signing_secret text;

-- For tokens created before this migration, signing_secret is NULL.
-- The route handler treats those tokens as v1-only — they will fail
-- v2 verification with 401 because there's no secret to HMAC with.
-- Users must regenerate their token to get a signing secret. The
-- /ea-setup UI surfaces this with a "Token uses legacy protocol —
-- regenerate to enable replay protection" badge.
```

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
- Regenerating a token (existing flow) gets a new `signing_secret` and the user must update their MT5 config with BOTH the bearer AND the signing secret.
- The `/ea-setup` UI shows the signing secret **once** at generation time, same as the bearer, with the same "you'll never see this again" warning.

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

## 8. Open questions for Codex review

1. **Are we OK storing `signing_secret` in plaintext in `ea_tokens`?** Alternative: encrypt-at-rest with `EA_SIGNING_SECRET_KEK` env var via `crypto.createCipheriv(aes-256-gcm, ...)`. Adds one moving part for marginal benefit (encrypted-at-rest if attacker has DB but not env). I lean: skip it, but flag it if you disagree.
2. **Window size:** ±5 min was chosen for MT5 hosts that may have drifted clocks. Tighter (±2 min) is more robust but risks rejecting legitimate requests from VPS instances without NTP. Looser (±10 min) widens the replay window. OK with ±5?
3. **Cutover:** 30-day window with a hard 410 cutoff. Or do you prefer a softer rolling cutoff (e.g. v1 gets stricter rate limit, then 410)?
4. **Should `cleanup_ea_request_nonces` run from a Vercel cron**, or is it fine to rely on the table staying small (10 min TTL × 60 req/min peak × N tokens ≈ trivial)?
5. **Header name** — `X-Ingest-Protocol` vs `X-EA-Protocol-Version`. I went with the former for parallel with HTTP convention; happy to bikeshed.

---

## 9. Rough implementation order (once approved)

1. Migrations `0041_ea_tokens_signing_secret.sql` + `0042_ea_request_nonces.sql`
2. `web/lib/ea/sig.ts` — `canonicalMessage()`, `verifySig()`, plus EA-side reference TypeScript that can be ported to MQL5
3. `web/lib/actions/ea-tokens.ts` — `generateEaTokenAction` returns `{ rawToken, signingSecret, id }` and inserts both
4. `web/app/api/ea/ingest/route.ts` — protocol-version branch, v2 validation pipeline
5. `web/app/(app)/ea-setup/...` — show signing secret once on generation; "legacy token" badge for NULL-signing-secret tokens
6. MT5 EA update (MQL5 source under `mql5/`) — send `X-Ingest-Protocol: v2`, compute HMAC, manage nonce counter (likely random GUID per send)
7. Tests above
8. Deprecation banner + cutover env flag

Total work: ~1 focused day for server + tests, separate day for MT5 EA.
