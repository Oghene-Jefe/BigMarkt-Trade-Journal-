# BigMarkt Journal App

Production journal app for `journal.bigmarkt.co`.

## Stack

- Next.js 15.5 App Router, React 19, TypeScript strict
- Supabase Postgres with RLS and cookie-based auth via `@supabase/ssr`
- Tailwind CSS
- Vercel deployment from the `web/` root directory
- Vitest for unit, privacy, rendering, ingest, and integration-style checks

## Setup

```bash
cd web
cp .env.example .env.local
npm ci
npm run dev
```

`npm run dev` starts the app at `http://localhost:3000`.

## Commands

```bash
npm run typecheck       # tsc --noEmit against tsconfig.typecheck.json
npm run typecheck:full  # full TypeScript project check
npm test                # vitest run
npm run build           # required before pushing journal changes
npm run news:run        # local helper for the news cron path
```

Privacy tests need Supabase credentials and should run against staging or a
production-like non-destructive project:

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm test -- tests/privacy.spec.ts --run
```

## Required Environment

See `.env.example` for the full annotated list. The production Vercel project
must at minimum provide:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `EA_SIGNING_SECRET_ENCRYPTION_KEY`
- `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY`
- `WS_STATUS_URL`
- `WS_STATUS_SECRET`

Optional or feature-specific variables include Turnstile keys, Bybit proxy
settings, `EA_INGEST_V1_CUTOFF_AT`, and `METAAPI_TOKEN_ENCRYPTION_KEY`.
MetaApi's key is required before enabling provisioning or cron sync for
`metaapi_connections`.

## Current App Surface

Authenticated app routes include dashboard, accounts, journal, imports,
analytics, calculator, challenges, constitution, EA setup, brokers, exchanges,
discover, feed, following, leaderboard, notifications, profile, settings,
upgrade, disputes, and admin tools.

Public routes include:

- `/` landing page
- `/privacy`
- `/guide` plus the first Getting Started guide pages
- `/@username` and `/p/[id]` public profiles
- `/c/[id]` chart image redirect
- `/api/public/platform-stats`

## Capture Paths

- Manual trades write through server actions and keep user-entered data private
  unless the trader opts into public visibility.
- EA capture writes directly into `trades` through `/api/ea/ingest` using
  HMAC-signed requests and per-token signing secrets.
- Bybit exchange connections are read-only, encrypted at rest, and staged
  through exchange-specific tables before user review.
- MetaApi read-only sync scaffolding exists under `lib/metaapi/` and migration
  `0083`, but cron, provisioning UI, and live payload refinement are not built
  yet.

Public feeds and public profiles do not expose raw dollar P&L. They use
`return_pct` first, `rr_ratio` second, and fall back to the win/loss result.
Owner and admin surfaces can still show private dollar data.

## Database Migrations

Migration files live in `../supabase/migrations/`. Production migrations are
applied manually in the Supabase SQL Editor and then verified against the live
schema. Do not run `supabase db push` against production for this project.

The current production migration state and next migration number are tracked in
`../CURRENT_STATE.md`. Operational details are in
`../docs/database-migrations.md`.

## Project Layout

```text
web/
  app/                       # App Router pages, layouts, route handlers
  components/                # Shared UI and feature components
  hooks/                     # Client hooks
  lib/
    actions/                 # Server actions split by feature area
    constitution/            # Trading constitution rules and scoring
    cron/                    # Cron auth helpers
    ea/                      # EA normalization, signatures, token secrets
    exchanges/               # Read-only Bybit connection and sync helpers
    metaapi/                 # Read-only MetaApi sync scaffolding
    news/                    # Forex Factory feed parsing
    supabase/                # Browser, server, admin, middleware clients
  public/                    # Favicons, images, EA downloads
  scripts/                   # Local smoke/utility scripts
  tests/                     # Vitest suites
```

## Deployment Notes

Vercel crons are defined in `vercel.json`:

- `/api/cron/news-feed` daily at 00:00 UTC
- `/api/cron/recalculate-scores` daily at 02:00 UTC
- `/api/cron/cleanup` daily at 03:00 UTC

All cron routes require `CRON_SECRET`. The EA setup page polls the Railway
WebSocket status service through `WS_STATUS_URL` and `WS_STATUS_SECRET`; see
`../websocket-server/RAILWAY_DEPLOY.md`.
