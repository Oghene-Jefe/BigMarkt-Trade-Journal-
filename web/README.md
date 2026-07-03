# BigMarkt Trade Journal - Web

Production Next.js + Supabase journal app for `journal.bigmarkt.co`.

The legacy static app is archived under `../archive/legacy-static-app/`; `web/`
is the deployed app root. The app uses cookie-based Supabase auth, private
storage with server-minted signed URLs, strict RLS, server actions, and RPCs for
public/community read paths.

## Current app surface

- Auth: login, signup, reset, callback, onboarding.
- App: dashboard, journal, analytics, calculator, challenges, accounts, EA
  setup, exchanges, feed, following, discover, leaderboard, notifications,
  profile/settings, upgrade waitlist, disputes, admin tools.
- Public: `/@username`, `/p/[id]`, chart proxy `/c/[id]`, privacy page,
  sitemap, OG image route.
- APIs: EA ingest/status, cron jobs for cleanup/news/score recalculation,
  public platform stats.
- Supabase schema and RPC history live in `../supabase/migrations/`.

## Setup

```bash
cd web
cp .env.example .env.local       # fill in Supabase URL + anon key
npm install
npm run dev                      # http://localhost:3000
```

### Required environment

See `.env.example` for the full list. The common local minimum is:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Server-only features need additional secrets:

- `SUPABASE_SERVICE_ROLE_KEY` for EA ingest and privacy tests.
- `EA_SIGNING_SECRET_ENCRYPTION_KEY` for EA v2 token signing secrets.
- `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` for encrypted exchange credentials.
- `CRON_SECRET` for cron routes.
- `WS_STATUS_URL` and `WS_STATUS_SECRET` for `/ea-setup` presence status.
- Optional Bybit proxy vars: `BYBIT_MAINNET_BASE_URL`,
  `BYBIT_TESTNET_BASE_URL`, `BYBIT_PROXY_TOKEN`.

### Apply migrations

Write schema changes as files in `../supabase/migrations/` and apply them with
the Supabase CLI. Run against staging first.

Using the Supabase CLI:

```bash
# from repo root
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Avoid untracked dashboard SQL edits in production. They create drift between
the repo and the live database.

### Grant admin

```sql
insert into public.admin_users (user_id, note)
values ('00000000-0000-0000-0000-000000000000', 'manually granted 2026-05-09');
```

Never grant admin via the API — `admin_users` has no INSERT policy by design.

### Verify

```bash
npm run typecheck
npm test
npm run build
```

The privacy tests need a service-role key to spin up disposable users. Use a
non-production project for real RLS runs:

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm test
```

## Migration notes from the static app

| Old behaviour                                                | New behaviour                                                  |
|--------------------------------------------------------------|----------------------------------------------------------------|
| `ADMIN_EMAILS` array in `js/state.js`                        | `public.admin_users` table + `is_admin()` SQL function         |
| `_sb.from('profiles').select('*')` from admin panel           | `admin_list_users()` RPC, gated by `is_admin(auth.uid())`      |
| Leaderboard reads raw trades + emails from browser            | `get_leaderboard()` RPC; emails never leave the database       |
| `getPublicUrl` on public `trade-charts` / `avatars` buckets   | Private buckets + per-request signed URLs minted server-side   |
| `innerHTML` rendering with manual `escHtml`                   | React text rendering by default; `rendering.spec.tsx` pins it  |
| `localStorage` Supabase tokens (default v2)                   | Cookie-based session via `@supabase/ssr`                       |
| Profile email exposed to anon reads                           | RLS blocks anon SELECT on `profiles` entirely                  |
| Schema lived only in the dashboard                            | `supabase/migrations/000N_*.sql` in version control            |

## Project layout

```
web/
  app/
    (auth)/                  # login, signup, reset, reset/confirm, actions.ts
    auth/callback/           # email-link redirect handler
    (app)/                    # authenticated journal application
    (public)/[username]/      # public profile by username
    p/[id]/                   # public profile by user id
    c/[id]/                   # signed chart proxy
    api/                      # cron, EA, public stats, OG routes
    onboarding/               # first-run setup
    layout.tsx, page.tsx, globals.css
  lib/
    actions/                  # server actions / RPC wrappers
    ea/                       # EA normalization, signatures, secrets
    exchanges/                # Bybit client, signing, encryption
    supabase/
      client.ts              # browser client
      server.ts              # server component / action client
      middleware.ts          # session refresh
    schemas.ts               # Zod schemas (shared client + server)
  tests/
    *.spec.ts[x]             # unit, privacy, ingest, exchange, rendering tests
  middleware.ts              # wires lib/supabase/middleware.ts

../supabase/
  migrations/
    0001_*.sql ... 0082_*.sql
```
