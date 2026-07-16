# BigMarkt journal web app

The production Next.js 15 / React 19 journal served at [journal.bigmarkt.co](https://journal.bigmarkt.co). It provides authentication and onboarding, manual and broker-verified journaling, analytics, the Trading Constitution, public profiles, feeds and reactions, leaderboards, referrals, admin tools, and the in-app guide.

Broker capture supports the self-hosted MT5 EA and Pro cloud capture through MetaApi. Bybit connection code is present as a read-only integration; its credential model is documented in [`docs/EXCHANGE_SECURITY.md`](docs/EXCHANGE_SECURITY.md).

## Requirements

- Node.js 20 or newer
- npm
- A Supabase project for authenticated flows

## Setup

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The minimum browser configuration is `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; server-side ingestion, cron, encryption, and cloud features require the additional secrets described in `.env.example`.

## Commands

```bash
npm run dev             # local Next.js server with Turbopack
npm run lint            # ESLint
npm run typecheck       # CI TypeScript configuration
npm run typecheck:full  # full TypeScript configuration
npm test                # Vitest suite
npm run build           # production build
npm run start           # serve a completed production build
```

The privacy integration tests need `SUPABASE_SERVICE_ROLE_KEY` and must only be run against a disposable non-production Supabase project. Tests that do not have the service key self-skip that integration coverage.

## Database changes

Create an additive, reviewable SQL file in `../supabase/migrations/`. Production migrations are applied manually through the Supabase SQL Editor and then verified against the live schema; never use `supabase db push` against production. See [`../docs/database-migrations.md`](../docs/database-migrations.md).

Administrators are granted by inserting the user's UUID into `public.admin_users` through an authorized database administration channel. There is intentionally no client-side or public insert path.

## Architecture

- `app/` — App Router pages, server actions, API and cron routes
- `components/` — shared journal and guide UI
- `lib/` — domain logic, scoring, Supabase access, capture integrations, and security helpers
- `tests/` — Vitest unit, rendering, privacy, and ingestion coverage
- `public/downloads/` — versioned EA downloads
- `../supabase/migrations/` — database schema history

The retired static application is isolated in `../archive/legacy-static-app/` and is not a deployment target.

## Deployment

The journal Vercel project uses `web/` as its Root Directory and deploys from `main`. Its scheduled routes are declared in `vercel.json`. The EA presence server is deployed separately from `../websocket-server/`.
