# BigMarkt Live Readiness Checklist

Updated: June 27, 2026

BigMarkt is ready for a controlled beta / live pilot only after the checks below
are confirmed against the production Vercel, Railway, and Supabase projects.

## 1. Production environment audit

Required Vercel journal variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `EA_SIGNING_SECRET_ENCRYPTION_KEY`
- `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY`
- `WS_STATUS_URL`
- `WS_STATUS_SECRET`

Optional Vercel variables:

- `EA_INGEST_V1_CUTOFF_AT`
- `BYBIT_MAINNET_BASE_URL`
- `BYBIT_TESTNET_BASE_URL`
- `BYBIT_PROXY_TOKEN`

Required Railway WebSocket variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WS_STATUS_SECRET`

Acceptance criteria:

- Service-role and encryption secrets exist only in server-side environments.
- `EA_SIGNING_SECRET_ENCRYPTION_KEY` and
  `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` decode to at least 32 bytes.
- `WS_STATUS_SECRET` is present on both Vercel and Railway and values match.
- `WS_STATUS_URL` points to the deployed Railway `/status` endpoint.
- `NEXT_PUBLIC_SITE_URL` is the canonical journal origin used for reset links.
- No `.env`, `.env.local`, Vercel metadata, service-role keys, exchange keys,
  EA tokens, signing secrets, or user credentials are tracked in GitHub.

## 2. Supabase privacy / RLS tests

Run the privacy test suite against a staging or production-like Supabase
project.

```bash
cd web
SUPABASE_SERVICE_ROLE_KEY=... npm test -- tests/privacy.spec.ts --run
```

Acceptance criteria:

- Privacy tests run instead of skipping.
- Users cannot read or mutate another user's private trades, profile-only
  fields, broker accounts, EA tokens, notifications, support messages,
  exchange credentials, or leaderboard score rows.
- `account_scores` remains read-only to authenticated users; score writes only
  happen through trusted service-role/server-side flows.
- Public follow graph RPCs return only public profile fields and never email.

## 3. Live EA smoke test

Connect one MT5 terminal using a fresh token from `/ea-setup`.

Steps:

- Confirm `/ea-setup` offers `BigMarkt_EA_v2.7.1.mq5`.
- Generate a fresh EA token, token UUID, and signing secret.
- Link the token to an active broker account.
- Configure MT5 with the endpoint `https://journal.bigmarkt.co/api/ea/ingest`
  and allow-list `https://journal.bigmarkt.co` for WebRequest.
- Confirm Railway WebSocket service is healthy at `/healthz`.
- Confirm `/ea-setup` shows the EA as connected through the scoped `/status`
  poll.
- Send one small demo fill and one SL/TP modification.
- Restart the EA with an open position and confirm an `open_snapshot` event
  reconciles live open-state without creating duplicates.

Acceptance criteria:

- Valid v2 requests are accepted and rejected replays return safely.
- Invalid, revoked, or legacy-without-signing-secret tokens are rejected.
- Token `last_used_at` updates.
- `trade_events` records deal/order/position-modify/snapshot events
  idempotently.
- Journal rows have `capture_source = ea` and an account-appropriate
  `trust_badge`.
- Account score recalculation runs when the token is linked to a broker
  account.
- `/status` only returns connections matching the current user's token IDs.

## 4. Community and Pro smoke test

Steps:

- Follow a trader from `/leaderboard`; confirm the button changes to
  Following.
- Confirm the trader appears in `/following`.
- Enable auto-share of verified EA trades from the followed leader's profile
  settings or profile form.
- Confirm `/feed` shows only closed, verified, non-demo EA trades from leaders
  the caller follows.
- Pause and unfollow; confirm `/following` and `/feed` update accordingly.
- Visit `/upgrade` as a free user; join and leave the waitlist.
- Visit `/upgrade` as a `pro` + `active` and `pro` + `comp` profile; confirm the
  entitled states render and no payment flow is presented.

Acceptance criteria:

- Follow/unfollow is journal-only; execution/copy-trade mode is not exposed.
- Feed visibility is limited to `public` and `followers_only` verified EA
  trades.
- `pro_interest_at` is stamped idempotently and can be cleared.

## 5. Exchange sync smoke test

Steps:

- Add a read-only Bybit key in `/exchanges/new`.
- Confirm credentials are encrypted before storage.
- Run a sync for a small date window.
- If direct Bybit access is blocked, route through the optional proxy variables
  and confirm the proxy token is required.

Acceptance criteria:

- Keys with withdrawal or transfer permissions are rejected.
- The encryption key is required for decrypt/sync paths.
- No plaintext API secret is logged or returned to the browser.

## 6. Cron smoke tests

Routes configured in `web/vercel.json`:

- `/api/cron/news-feed` at `0 0 * * *`
- `/api/cron/recalculate-scores` at `0 2 * * *`
- `/api/cron/cleanup` at `0 3 * * *`

Acceptance criteria:

- Missing or wrong `Authorization: Bearer <CRON_SECRET>` returns 401.
- News cron upserts `news_events` rows including URL where available.
- Score cron recalculates account/leaderboard scores without client-side write
  access.
- Cleanup cron completes without deleting active user data.

## 7. Final launch decision

Controlled beta / live pilot: approved after environment variables, privacy
tests, EA smoke, community/feed smoke, exchange smoke, and cron smoke pass.

Final sign-off fields:

- Environment audit completed by:
- Privacy/RLS tests completed by:
- Live EA smoke test completed by:
- Community/feed/Pro smoke test completed by:
- Exchange sync smoke test completed by:
- Cron smoke tests completed by:
- Launch approved by:
