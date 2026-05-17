# BigMarkt Live Readiness Checklist

Generated: May 17, 2026

Current readiness score: 96/100

BigMarkt is ready for a controlled beta / live pilot. Before a full public launch, complete and sign off the checks below.

## 1. Production Environment Audit

Confirm that production Vercel, Railway, and Supabase environments contain the required variables and that no real secrets are committed to GitHub.

Required Vercel variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- CRON_SECRET
- WS_STATUS_URL
- WS_STATUS_SECRET

Required Railway WebSocket variables:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- WS_STATUS_SECRET

Acceptance criteria:

- CRON_SECRET is present and strong.
- WS_STATUS_SECRET is present on both Vercel and Railway and values match.
- WS_STATUS_URL points to the deployed Railway `/status` endpoint.
- Service-role keys exist only in server-side environments.
- No `.env`, `.env.local`, Vercel metadata, service-role keys, exchange keys, or user credentials are tracked in GitHub.

## 2. Supabase Privacy / RLS Tests

Run the privacy test suite against a staging or production-like Supabase project.

Command from `web/`:

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm test -- tests/privacy.spec.ts --run
```

Acceptance criteria:

- Privacy tests run instead of skipping.
- Users cannot read or mutate another user's private trades, profile-only fields, broker accounts, EA tokens, notifications, support messages, or leaderboard score rows.
- `account_scores` remains read-only to authenticated users; score writes only happen through trusted service-role/server-side flows.

## 3. Live EA Smoke Test

Connect one MT5 terminal using a fresh EA token and verify the full live path.

Steps:

- Generate a fresh EA token in `/ea-setup`.
- Configure the MT5 EA with that token.
- Confirm Railway WebSocket service is healthy at `/healthz`.
- Confirm `/ea-setup` shows the EA as connected.
- Send one small test trade or use a demo account fill.
- Confirm token `last_used_at` updates.
- Confirm a journal row appears with `capture_source = ea` and `trust_badge = auto_verified`.
- Confirm account score recalculation runs when the token is linked to a broker account.

Acceptance criteria:

- No server errors in Vercel logs.
- No WebSocket auth errors in Railway logs for the valid token.
- Invalid/revoked tokens are rejected.
- `/status` only returns connections matching the current user's token IDs.

## 4. News Feed Cron Smoke Test

Verify the economic news flow in production.

Steps:

- Call the news cron with the production CRON_SECRET.
- Confirm `news_events` receives/upserts rows.
- Confirm the Journal `News` tab shows events.
- Confirm event links open the Forex Factory URL when available.

Acceptance criteria:

- Unauthorized cron requests return 401.
- Missing CRON_SECRET returns a safe server error, not an accidental open endpoint.
- News rows contain title, event_time, impact, currency where available, and url where present.

## 5. Final Launch Decision

Launch status:

- Controlled beta / live pilot: approved after environment variables are confirmed.
- Full public launch: approved only after privacy tests and live EA smoke test pass.

Final sign-off fields:

- Environment audit completed by:
- Privacy/RLS tests completed by:
- Live EA smoke test completed by:
- News cron smoke test completed by:
- Launch approved by:
