# BigMarkt Journal Web App

`web/` is the production journal app for `journal.bigmarkt.co`. It is a
Next.js App Router application backed by Supabase Postgres, RLS, private
storage buckets, and server-only service-role flows.

The archived static app is preserved at `../archive/legacy-static-app/` for
reference only. It is not deployed.

## Current Product Surface

- Email/password auth, reset, callback handling, and first-run onboarding
- Dashboard activation flow, journal CRUD/imports, analytics, calculator, challenges
- Public profiles at `/@username` and `/p/[id]`, public chart proxy at `/c/[id]`
- Leaderboard, follow graph, Discover search, Following feed, live open-position strip
- EA setup, token management, v1/v2 EA ingest, signed/replay-protected v2 envelopes
- Broker account management, broker submissions, exchange connection tooling
- Trading Constitution rule checks and public adherence signal
- Notifications, support chat, disputes, referrals, upgrade waitlist, admin panels
- Cron routes for news feed, cleanup, and score recalculation

## Setup

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Minimum local env:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Feature-dependent env:

| Variable | Used for |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Privacy tests, admin/server flows, EA ingest, crons, scripts |
| `CRON_SECRET` | `/api/cron/*` route authorization |
| `WS_STATUS_URL`, `WS_STATUS_SECRET` | EA setup presence polling via Railway WebSocket service |
| `EA_SIGNING_SECRET_ENCRYPTION_KEY` | EA v2 per-token signing-secret encryption |
| `EA_INGEST_V1_CUTOFF_AT` | Optional ISO cutoff for rejecting legacy v1 EA ingest |
| `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` | Exchange API credential envelope encryption |
| `BYBIT_MAINNET_BASE_URL`, `BYBIT_TESTNET_BASE_URL`, `BYBIT_PROXY_TOKEN` | Optional Bybit proxy |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Turnstile-protected forms |

See `.env.example` for notes and generation commands.

## Commands

```bash
npm run dev             # local Next.js dev server
npm run build           # production build, required before push
npm run start           # serve a built app
npm run lint            # ESLint
npm run typecheck       # app typecheck via tsconfig.typecheck.json
npm run typecheck:full  # full TypeScript check
npm test                # Vitest unit/privacy suites
npm run news:run        # run the news cron code locally, bypassing CRON_SECRET
```

Privacy tests need a service-role key and should run against staging or another
non-production project:

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm test -- tests/privacy.spec.ts --run
```

## Database Migrations

Schema changes live in `../supabase/migrations/`. Current project convention is
to apply production migrations manually in the Supabase SQL Editor and verify
the created functions/tables/policies directly in Supabase. Do not use
`supabase db push` for production.

When adding a migration:

1. Create the next numbered `../supabase/migrations/00NN_description.sql` file.
2. Test against a non-production Supabase project when possible.
3. Apply the exact SQL manually in the production SQL Editor when approved.
4. Verify persistence, especially for RPC definitions in `pg_proc`.
5. Commit the migration with the matching application changes.

## Project Layout

```text
web/
  app/
    (auth)/                 login, signup, reset, server actions
    (app)/                  authenticated app routes
    (public)/[username]/    public username profile
    api/                    EA ingest, crons, public platform stats, OG
    auth/callback/          Supabase email-link callback
    onboarding/             first-run profile setup
    p/[id]/                 legacy/public UUID profile
  components/               shared UI and product components
  lib/                      Supabase clients, actions, scoring, EA, exchange, storage
  scripts/                  local maintenance/smoke scripts
  tests/                    Vitest coverage for security and domain logic
  docs/                     web-specific security notes
```

## Deployment

Vercel is configured with `web/` as the project root and deploys on push to
`main`. The service-role key is server-only and must be set only as a sensitive
server environment variable; never expose it with a `NEXT_PUBLIC_` prefix or
import the admin client from client components.
