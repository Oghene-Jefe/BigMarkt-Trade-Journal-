# BigMarkt Trade Journal

The production Next.js application for [journal.bigmarkt.co](https://journal.bigmarkt.co).
It provides authenticated journaling, analytics, account scoring, leaderboards,
public profiles, social feeds, and manual or read-only broker capture.

## Stack

- Next.js 15.5, React 19, and strict TypeScript
- Supabase Auth, Postgres with RLS, and private Storage buckets
- Tailwind CSS 3
- Vitest for unit, rendering, privacy, and ingest regression coverage
- Vercel deployment and daily cron jobs

## Local setup

Node.js 20 or newer is recommended.

```bash
cd web
cp .env.example .env.local
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). At minimum, local auth
requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Server-only features require the corresponding values documented in
`.env.example`; never expose service-role or encryption keys through a
`NEXT_PUBLIC_` variable.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Turbopack development server |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint TypeScript and TSX files |
| `npm run typecheck` | Type-check the supported app configuration |
| `npm run typecheck:full` | Type-check the complete project |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run news:run` | Run the news importer script manually |

Some privacy tests need `SUPABASE_SERVICE_ROLE_KEY` and must only target a
non-production Supabase project.

## Database migrations

Migrations live in [`../supabase/migrations/`](../supabase/migrations/) and are
ordered by filename. Create a new migration for every schema or policy change.
The current production workflow is manual application through the Supabase SQL
Editor; do not use `supabase db push` against production. Follow
[`../docs/database-migrations.md`](../docs/database-migrations.md), including
its warning that the repository is not yet a clean reproducible baseline.

## Capture paths

- Manual trades use authenticated server actions.
- The MT5 EA sends HMAC-signed, replay-protected HTTP requests to
  `/api/ea/ingest`; `MIGRATIONS_APPLIED=true` enables the current
  position-aware ingest path.
- The separate WebSocket service reports EA connection presence only and does
  not ingest trades.
- Bybit connections use encrypted read-only API credentials.
- MetaApi cloud accounts are provisioned for eligible users, synced on demand,
  and undeployed when idle to control hosting cost.

## Scheduled jobs

`vercel.json` defines daily jobs for the economic-news feed, score
recalculation, MetaApi provisioning/cleanup, and housekeeping. Every cron route
requires `CRON_SECRET`. MetaApi automatic trade sync is not performed by the
daily cron; users initiate the deploy/connect/sync/undeploy cycle from the
Accounts UI.

## Project map

```text
web/
  actions/          shared server actions
  app/              App Router pages, server actions, and API routes
  components/       shared UI and feature components
  hooks/            client hooks
  lib/              domain logic and external-service clients
  public/           static assets and EA downloads
  scripts/          operational scripts
  tests/            Vitest suites
```

User-facing product documentation is available under `/guide` and implemented
in `app/guide`, `components/guide`, and `lib/guide/nav.ts`. The current shipped
feature and migration record is maintained in [`../CURRENT_STATE.md`](../CURRENT_STATE.md).
