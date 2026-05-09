# BigMarkt Trade Journal — Web (rebuild)

Next.js + Supabase rebuild of the static HTML/JS journal in the repo root.
This directory is **parallel** to the old app — nothing in `../js/`, `../css/`,
or `../index.html` is touched. Cutover happens once Slices 1–N are verified.

## What's in this slice (Slice 1 — security foundation)

- Versioned Supabase schema in [`../supabase/migrations/`](../supabase/migrations/).
- Strict RLS: anon clients can read **nothing** from base tables.
- `admin_users` table replaces the old client-side `ADMIN_EMAILS` allowlist.
- Sanitized `get_leaderboard` / `get_public_profile` RPCs (no email leakage,
  respect profile visibility).
- Private storage buckets (`avatars`, `trade-charts`) — public sharing is
  signed-URL only, minted server-side.
- Cookie-based auth via `@supabase/ssr` so RLS works in Server Components.
- Email + password login / signup / reset, all through server actions with
  Zod validation.
- Privacy + rendering test suites (`vitest`).

UI pages beyond auth + an empty dashboard land in Slice 2.

## Setup

```bash
cd web
cp .env.example .env.local       # fill in Supabase URL + anon key
npm install
npm run dev                      # http://localhost:3000
```

### Apply migrations

The migrations are written to be idempotent and additive against the existing
production schema, but **run them on a staging project first**.

Using the Supabase CLI:

```bash
# from repo root
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or paste each `supabase/migrations/000N_*.sql` file into the dashboard SQL
editor in order.

### Grant admin

```sql
insert into public.admin_users (user_id, note)
values ('00000000-0000-0000-0000-000000000000', 'manually granted 2026-05-09');
```

Never grant admin via the API — `admin_users` has no INSERT policy by design.

### Run privacy tests

The tests need a service-role key to spin up disposable users. **Use a
non-production project.**

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm test
```

## Migration notes from the static app

| Old behaviour                                                | New behaviour                                                  |
|--------------------------------------------------------------|----------------------------------------------------------------|
| `ADMIN_EMAILS` array in `js/state.js`                        | `public.admin_users` table + `is_admin()` SQL function         |
| `_sb.from('profiles').select('*')` from admin panel           | `admin_list_users()` RPC, gated by `is_admin(auth.uid())`      |
| Leaderboard reads raw trades + emails from browser            | `get_leaderboard()` RPC; emails never leave the database       |
| `getPublicUrl` on public `trade-charts` / `avatars` buckets   | Private buckets + per-request signed URLs (Slice 3)            |
| `innerHTML` rendering with manual `escHtml`                   | React text rendering by default; `rendering.spec.tsx` pins it  |
| `localStorage` Supabase tokens (default v2)                   | Cookie-based session via `@supabase/ssr`                       |
| Profile email exposed to anon reads                           | RLS blocks anon SELECT on `profiles` entirely                  |
| Schema lived only in the dashboard                            | `supabase/migrations/000N_*.sql` in version control            |

### Data migration

Existing rows in `profiles` and `trades` keep working. The migrations only
**add** columns (`visibility`, `display_name`, `updated_at`) with safe
defaults. No destructive changes. After applying:

1. Existing profiles default to `visibility = 'private'` — they vanish from
   the leaderboard until users opt in. This is the correct default per the
   privacy brief.
2. Existing trades default to `visibility = 'private'`.
3. Existing storage objects in the now-private buckets stay accessible to
   their owner. Old `getPublicUrl` links break — Slice 3 generates signed
   URLs in their place. Communicate this to active users before cutover.

## Project layout

```
web/
  app/
    (auth)/                  # login, signup, reset, reset/confirm, actions.ts
    auth/callback/           # email-link redirect handler
    dashboard/               # placeholder, filled in Slice 2
    layout.tsx, page.tsx, globals.css
  lib/
    supabase/
      client.ts              # browser client
      server.ts              # server component / action client
      middleware.ts          # session refresh
    schemas.ts               # Zod schemas (shared client + server)
  tests/
    privacy.spec.ts          # RLS + sanitization tests
    rendering.spec.tsx       # XSS-safe rendering pins
  middleware.ts              # wires lib/supabase/middleware.ts

../supabase/
  migrations/
    0001_baseline_schema.sql
    0002_rls_policies.sql
    0003_leaderboard_rpc.sql
    0004_storage_policies.sql
```

## What's next

- **Slice 2**: trades CRUD + JournalTable + TradeForm.
- **Slice 3**: signed-URL flow for chart screenshots + avatars.
- **Slice 4**: leaderboard UI + public profile pages.
- **Slice 5**: server-only admin panel.
- **Slice 6**: challenges, referrals, balance resets, analytics.
