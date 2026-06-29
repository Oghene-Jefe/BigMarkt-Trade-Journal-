# BigMarkt Trade Journal — Web

Production Next.js + Supabase app for `journal.bigmarkt.co`.

## What Is Live

- Cookie-based Supabase auth with login, signup, reset, onboarding, and protected app routes.
- Private dashboard, journal, manual trade entry, imports, analytics, accounts, challenges, profile, notifications, support, and admin surfaces.
- Public leaderboard/profile/share pages that sanitize profile and trade data through RPCs.
- Follow graph with Discover search, Following, and a feed of live/open plus verified closed trades from followed leaders.
- MT5 EA setup, token management, HMAC-signed HTTP ingest, EA connection status polling, and compiled EA downloads.
- Exchange/Bybit read-only credential storage and sync code remains available by direct route but is hidden from the primary rollout nav.
- Private `avatars` and `trade-charts` buckets; public rendering uses signed URLs or the chart proxy.

## Setup

```bash
cd web
cp .env.example .env.local
npm install
npm run dev                      # http://localhost:3000
```

Fill `.env.local` from `.env.example`. Local feature work usually needs the
Supabase URL/anon key. Server-side routes and scripts that use admin writes,
EA ingest, cron jobs, exchange credentials, or WS status polling need the
corresponding server-only secrets documented in that file.

### Apply migrations

Migrations live in [`../supabase/migrations/`](../supabase/migrations/).
For this project, production migrations are committed to the repo and then
applied manually in the Supabase SQL Editor. Do **not** run `supabase db push`
against production.

For local/staging databases, apply migration files in filename order and verify
any changed RPC signatures before testing app code against them.

### Grant admin

```sql
insert into public.admin_users (user_id, note)
values ('00000000-0000-0000-0000-000000000000', 'manually granted 2026-05-09');
```

Never grant admin via the public API — `admin_users` has no INSERT policy by design.

## Verification

Run the same gates as CI from `web/`:

```bash
npm run typecheck
npm test
npm run build
```

`privacy.spec.ts` self-skips unless a non-production `SUPABASE_SERVICE_ROLE_KEY`
is supplied. Do not point fixture-generating tests at production.

## Production Data Contracts

- Anon clients do not read base tables directly; public reads use sanitized RPCs.
- Public profile/feed trade surfaces do not expose raw `pnl`. They use `return_pct`, `rr_ratio`, result, public trade detail, chart proxy URLs, and public `trade_thesis`.
- `search_profiles(q)` returns only community/public profiles, excludes the caller, and requires at least two query characters.
- Feed data comes from followed leaders only and requires auth.
- Admin access is server-enforced through `admin_users`/admin RPCs, not by hidden UI alone.

## Project Layout

```text
web/
  app/
    (app)/                   # authenticated app: dashboard, journal, discover, feed, admin, etc.
    (auth)/                  # login, signup, reset, reset/confirm
    (public)/[username]/     # public @username profile
    api/ea/ingest/           # MT5 EA HTTP ingest
    api/cron/                # Vercel cron routes
    p/[id]/                  # legacy/profile-id public profile route
    layout.tsx, page.tsx, globals.css
  components/
    ui/                      # shared app UI primitives
    TradeCard.tsx            # feed card
    DiscoverSearch.tsx       # profile search UI
  lib/
    actions/                 # server actions and RPC wrappers
    ea/                      # EA payload normalization, HMAC signing, secret handling
    exchanges/               # Bybit read-only integration
    supabase/
  tests/                     # Vitest coverage for privacy, rendering, EA, exchange, chart URL, etc.

../supabase/
  migrations/                # committed schema/RPC history
```
