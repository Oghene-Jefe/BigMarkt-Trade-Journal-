# BigMarkt Trade Journal web app

Next.js + Supabase implementation of the BigMarkt Trade Journal. The
production Vercel project uses this directory as its root.

The legacy static app is archived at `../archive/legacy-static-app/` and is
not the production app.

## Current surface

- Auth: email/password signup, login, reset, callback handling, and onboarding.
- Journal: manual trade CRUD, chart uploads through private Supabase storage,
  imports, analytics, challenges, referrals, notifications, and support/admin
  workflows.
- Broker accounts: active-account switching, account scoring, Bybit read-only
  exchange sync, and encrypted exchange credentials.
- EA setup: token generation/revocation, broker-account linking, MT5 install
  wizard, WebSocket presence polling, and connection history.
- EA ingest: `POST /api/ea/ingest` accepts v1 legacy payloads until the
  configured cutoff and v2 HMAC-signed payloads for deals, orders,
  `position_modify`, and the v2.7.1 `open_snapshot` mirror event.
- Community: leaderboard tabs, public profile pages, follow/unfollow, following
  list, and `/feed` of verified EA trades from followed traders.
- Pro placeholder: `/upgrade` reads profile plan fields, shows comp/active/free
  states, and records `pro_interest_at` for the waitlist. It does not process
  payments yet.
- Cron routes: news import, score recalculation, and cleanup through Vercel
  cron using `CRON_SECRET`.

## Setup

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Local app URL: `http://localhost:3000`.

Fill at least:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
EA_SIGNING_SECRET_ENCRYPTION_KEY=<base64 32-byte key>
EXCHANGE_CREDENTIAL_ENCRYPTION_KEY=<base64 32-byte key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=<local random secret>
WS_STATUS_SECRET=<local random secret>
```

`WS_STATUS_URL` defaults to `http://localhost:8080/status` when omitted. Start
the WebSocket service from `../websocket-server` if you want `/ea-setup` to show
live EA presence locally.

Optional Bybit proxy variables are only needed when the deployment host is
blocked by Bybit/CloudFront:

```bash
BYBIT_MAINNET_BASE_URL=
BYBIT_TESTNET_BASE_URL=
BYBIT_PROXY_TOKEN=
```

## Database

Schema changes live in `../supabase/migrations/`. Apply migrations with the
Supabase CLI instead of editing production directly:

```bash
# from repo root
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

`docs/database-migrations.md` documents the drift check and the migration
discipline for production.

## Scripts

```bash
npm run dev             # Next dev server
npm run build           # production build
npm run start           # run built app
npm run lint            # ESLint
npm run typecheck       # CI typecheck project
npm run typecheck:full  # full tsconfig typecheck
npm test                # Vitest suite
npm run news:run        # run the news cron helper locally
```

Privacy/RLS tests need a real non-production Supabase service-role key. Without
one, the privacy spec self-skips. Unit tests for EA signing, exchange crypto,
Bybit normalization/signing, image sniffing, activation, rendering, news parsing,
and risk/reward run locally with dummy keys.

## Related services

- `../websocket-server`: Railway WebSocket presence/status service for MT5 EA
  connections. It does not ingest trades.
- `../web/public/downloads/BigMarkt_EA_v2.7.1.mq5`: EA file served by the web
  app's setup wizard.
- `../mql5/BigMarkt_EA.mq5`: older source copy currently declaring v2.5.1.
- `../infra/bybit-proxy-worker.js`: optional Cloudflare Worker egress proxy for
  Bybit API calls.

See `../docs/ea-ingest-and-ws-status.md` for the EA ingest and WebSocket status
contracts.
