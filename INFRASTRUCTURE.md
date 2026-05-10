# BigMarkt Trade Journal — Infrastructure

Comprehensive reference for the rebuild shipped 2026-05-09 → 2026-05-10. Single source of truth for what's deployed, where, and why.

The previous static HTML/JS app is preserved at the repo root for rollback (`index.html`, `js/`, `css/`, `assets/`, `manifest.json`) but is **not deployed** — Vercel's Root Directory points at `web/`. Plan to delete the legacy files ~1 week after stable cutover.

---

## Live URLs

| Surface | URL |
|---|---|
| Production app | https://journal.bigmarkt.co |
| Vercel auto-domain | https://big-markt-trade-journal-git-main-bigmarkts-projects.vercel.app |
| Supabase project | https://awvrylniqppybwaiwzse.supabase.co (region `eu-west-1`) |
| GitHub repo | https://github.com/Oghene-Jefe/BigMarkt-Trade-Journal- |
| Vercel project | https://vercel.com/bigmarkts-projects/big-markt-trade-journal |

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15.5 + React 19 + Turbopack | App Router, Server Components, Server Actions |
| Language | TypeScript 5.6, strict mode | |
| Styling | Tailwind CSS 3.4 | Brand tokens (gold/black/win/loss) lifted from old static app |
| Auth | Supabase Auth via `@supabase/ssr` | Cookie-based; RLS works in Server Components without extra plumbing |
| Database | Supabase Postgres | Schema versioned in `supabase/migrations/` |
| Storage | Supabase Storage, private buckets | Signed URLs only, no permanent public links |
| Validation | Zod | Shared client + server schemas |
| Tests | Vitest 3.x | Privacy + rendering suites |
| CI | GitHub Actions | Typecheck + build on push to `main` and on every PR |
| Hosting | Vercel | Root Directory = `web`, Framework Preset = Next.js |

---

## Repository layout

```
BigMarkt-Trade-Journal/
├── INFRASTRUCTURE.md         ← this file
├── CUTOVER.md                ← Vercel deployment guide
├── README.md                 ← upstream's original (legacy)
├── .gitignore                ← root, blocks .env*.local + secrets
├── .github/workflows/ci.yml  ← typecheck + build on push
├── index.html, js/, css/, assets/, manifest.json   ← LEGACY static app, not deployed
│
├── supabase/migrations/
│   ├── 0001_baseline_schema.sql
│   ├── 0002_rls_policies.sql
│   ├── 0003_leaderboard_rpc.sql
│   ├── 0004_storage_policies.sql
│   ├── 0005_consolidate_visibility.sql
│   ├── 0006_chart_path.sql
│   ├── 0007_avatar_path.sql
│   ├── 0008_public_trades_rpc.sql
│   ├── 0009_profile_on_signup.sql
│   ├── 0010_admin_rpcs.sql
│   ├── 0011_admin_purge_user_data.sql
│   └── _apply_all.sql        ← concatenation helper for one-paste application
│
└── web/                      ← Vercel's Root Directory
    ├── package.json
    ├── tsconfig.json
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── middleware.ts
    ├── app/
    │   ├── layout.tsx, page.tsx, globals.css
    │   ├── (auth)/             ← public auth pages
    │   │   ├── actions.ts        ← login / signup / reset / setPassword / logout
    │   │   ├── login/page.tsx
    │   │   ├── signup/page.tsx
    │   │   ├── reset/page.tsx, reset/confirm/page.tsx
    │   ├── (app)/              ← authed shell, requires session
    │   │   ├── layout.tsx        ← session gate + nav
    │   │   ├── actions.ts        ← trade CRUD server actions
    │   │   ├── dashboard/page.tsx
    │   │   ├── journal/page.tsx, new/, [id]/edit/
    │   │   ├── analytics/page.tsx
    │   │   ├── challenges/page.tsx, NewChallengeForm.tsx, actions.ts
    │   │   ├── leaderboard/page.tsx
    │   │   ├── profile/page.tsx, ProfileForm.tsx, BalanceResetForm.tsx, Referrals.tsx, actions.ts
    │   │   ├── balance/actions.ts
    │   │   └── admin/page.tsx, actions.ts
    │   ├── auth/callback/route.ts ← OAuth/email-link return
    │   └── p/[id]/page.tsx       ← public share page (no auth)
    ├── components/
    │   ├── TradeForm.tsx
    │   ├── JournalTable.tsx
    │   ├── ConfirmButton.tsx
    │   └── CompressedFileInput.tsx ← canvas downscale + JPEG q82 before upload
    ├── lib/
    │   ├── supabase/{client,server,middleware}.ts
    │   ├── schemas.ts            ← Zod, shared client + server
    │   ├── types.ts              ← DB row shapes (manually mirrored)
    │   ├── format.ts             ← fmtMoney, fmtDate, fmtPct
    │   ├── storage.ts            ← signCharts, signAvatars (server-only)
    │   └── admin.ts              ← isAdmin(), requireAdmin()
    └── tests/
        ├── privacy.spec.ts       ← anon-can't-read, RLS, admin gating (skipped without staging env)
        └── rendering.spec.tsx    ← XSS-safe rendering pin
```

---

## Database schema (live in prod)

### `public.profiles` — user data, mostly private
```
id                uuid     primary key, FK → auth.users(id) ON DELETE CASCADE
email             text     not null    PRIVATE; never returned by any anon-callable RPC
name              text                 legacy; use display_name
display_name      text                 shown publicly
source            text     'signup'    'signup' | 'google' | 'backfill'
referred_by       text                 ref code of referring user
ref_code          text                 (legacy column; new app derives from id)
starting_balance  numeric              for growth % calculation
daily_loss_limit  numeric  default 3
timezone          text     'Africa/Lagos'
experience        text
preferred_pairs   text                 free-text
avatar_url        text                 LEGACY public storage URL, deprecated
avatar_path       text                 storage object key, signed-URL minted on read
visibility        text     'private'   'private' | 'community' | 'public'
created_at        timestamptz default now()
updated_at        timestamptz not null default now()  ← updated by trigger
```

### `public.trades`
```
id                uuid     primary key default uuid_generate_v4()
user_id           uuid     not null, FK → auth.users(id) ON DELETE CASCADE
pair, direction, result    text not null   (BUY/SELL, WIN/LOSS/BE)
entry_price, exit_price, stop_loss, take_profit, lot_size   numeric
pnl               numeric  default 0
rr_ratio          numeric
session, emotions, strategy, setup_grade, tags, notes   text
image_url         text     LEGACY public URL or inline base64 data URL, deprecated
chart_path        text     storage object key (<user_id>/<trade_id>/chart-<ts>.<ext>)
trade_visibility  text     'public'    LEGACY (read by old static app)
visibility        text     not null default 'private'   'private' | 'public' | 'exclude'
created_at        timestamptz default now()
```

### `public.balance_resets`
```
id                uuid     primary key default gen_random_uuid()
user_id           uuid     FK → auth.users(id) ON DELETE CASCADE
previous_balance  numeric              snapshot of profiles.starting_balance at reset time
new_balance       numeric
reason            text                 free-text label
reset_date        date
created_at        timestamptz default now()
```

### `public.challenges`
```
id              uuid     primary key default gen_random_uuid()
user_id         uuid     FK → auth.users(id) ON DELETE CASCADE
goal_type       text     not null     used as title in UI
goal_target     numeric  not null
start_date, end_date    date not null
status          text     'active'     'active' | 'completed' | 'failed' | 'abandoned'
current_streak  integer  default 0    not yet wired into UI
longest_streak  integer  default 0
badge_earned    text
created_at      timestamptz default now()
completed_at    timestamptz
```

### `public.admin_users` — admin gate
```
user_id     uuid     primary key, FK → auth.users(id) ON DELETE CASCADE
granted_by  uuid     FK → auth.users(id)
granted_at  timestamptz not null default now()
note        text
```
Only `sylvesterejemah@gmail.com` is currently in this table. Read via `is_admin(uuid)` SQL function (SECURITY DEFINER), never via direct table access — RLS has no SELECT policy so direct reads return zero rows for everyone.

### `public.profiles_public` — sanitized view
```
id, display_name, avatar_path, visibility, created_at
```
Email-stripped projection of `profiles`. `security_invoker = true` so the underlying RLS still applies — only used by RPC bodies, not by anon HTTP.

---

## Foreign keys

All four user-data tables cascade-delete from `auth.users`:

```
profiles.id         → auth.users(id)  ON DELETE CASCADE
trades.user_id      → auth.users(id)  ON DELETE CASCADE
balance_resets.user_id → auth.users(id)  ON DELETE CASCADE
challenges.user_id  → auth.users(id)  ON DELETE CASCADE
admin_users.user_id → auth.users(id)  ON DELETE CASCADE
admin_users.granted_by → auth.users(id)
```

**Note:** these FKs are visible in `pg_constraint` but **not** in `information_schema.table_constraints` (Postgres hides cross-schema refs to schemas the caller can't read). Always introspect via `pg_constraint` for accuracy.

---

## RLS policies

Every user-owned table has RLS enabled. Anonymous clients can read **nothing** from base tables.

```
profiles
  profiles_self_select       authenticated, id = auth.uid()
  profiles_self_insert       authenticated, id = auth.uid()
  profiles_self_update       authenticated, id = auth.uid()
  (no DELETE policy — purge goes through admin_purge_user_data RPC)

trades
  trades_self_select         authenticated, user_id = auth.uid()
  trades_self_insert         authenticated, user_id = auth.uid()
  trades_self_update         authenticated, user_id = auth.uid()
  trades_self_delete         authenticated, user_id = auth.uid()

balance_resets
  resets_self_select         authenticated, user_id = auth.uid()
  resets_self_insert         authenticated, user_id = auth.uid()

challenges
  challenges_self_all        authenticated, user_id = auth.uid()  (CRUD)

admin_users                  RLS enabled, no policies → no direct access
```

Public discovery happens through SECURITY DEFINER RPCs (next section), not policies on these tables.

---

## RPCs

All admin RPCs gate with `is_admin(auth.uid())` and either `RAISE EXCEPTION '42501 not authorized'` (plpgsql) or `WHERE is_admin(...)` (sql). Both are leak-free; `raise` is preferred for new code.

| Function | Caller | Purpose |
|---|---|---|
| `is_admin(uid uuid)` | authenticated | True if uid in admin_users |
| `get_leaderboard(mode text, lim int)` | anon, authenticated | Sanitized leaderboard. No email returned. Excludes private profiles. |
| `get_public_profile(profile_id uuid)` | anon, authenticated | Aggregate stats for a community/public profile. No email. |
| `get_public_trades(profile_id uuid, lim int)` | anon, authenticated | List of trades where BOTH profile.visibility ∈ {community,public} AND trade.visibility = 'public'. |
| `get_referral_stats(ref_code text)` | anon, authenticated | Pre-existing RPC, returns { count } JSON. |
| `admin_overview()` | authenticated (admins only) | Aggregate stats: users, trades, P&L, top pair |
| `admin_list_users()` | authenticated (admins only) | All profiles with trade counts + total PnL |
| `admin_recent_signups(lim)` | authenticated (admins only) | Last N signups |
| `admin_recent_trades(lim)` | authenticated (admins only) | Last N trades joined with profile |
| `admin_top_pairs(lim)` | authenticated (admins only) | Top traded pairs by count |
| `admin_purge_user_data(target_id uuid)` | authenticated (admins only) | Deletes all public.* rows for target_id. Leaves `auth.users` row intact (use Supabase dashboard to finalise). |
| `handle_new_user()` | trigger on auth.users INSERT | Creates a profiles row on signup |
| `tg_set_updated_at()` | trigger on profiles UPDATE | Bumps updated_at |

---

## Storage

Two private buckets, both forced to `public = false`:

| Bucket | Path convention | Sharing |
|---|---|---|
| `avatars` | `<user_id>/avatar-<ts>.<ext>` | Server mints signed URL on each render |
| `trade-charts` | `<user_id>/<trade_id>/chart-<ts>.<ext>` | Same |

Storage RLS policies (`storage.objects`):

```
bm_avatars_owner_rw   authenticated, (storage.foldername(name))[1] = auth.uid()::text
bm_charts_owner_rw    authenticated, (storage.foldername(name))[1] = auth.uid()::text
```

The path convention IS the access control. A user uploading to `someone-else-id/whatever.png` is rejected at INSERT time. Anon LIST returns 401.

Server-side helpers in `lib/storage.ts`:
- `signCharts(paths[], ttl=3600)` / `signChart(path, ttl=3600)`
- `signAvatars(paths[], ttl=3600)` / `signAvatar(path, ttl=3600)`

URLs expire in 1 hour. Pages use `dynamic = "force-dynamic"` so URLs are minted fresh on every render.

---

## Routes

### Public (no auth)
| Route | Purpose |
|---|---|
| `/` | Brand splash; redirects to `/dashboard` if authed |
| `/login` | Email + password form |
| `/signup` | Includes hidden honeypot field |
| `/reset` | Request password reset link |
| `/reset/confirm` | Set new password (after clicking email link) |
| `/auth/callback` | OAuth/email-link return; exchanges code for session |
| `/p/[id]` | Public profile share page; uses `get_public_profile` + `get_public_trades` RPCs |

### Authed (under `(app)` route group, gate in `layout.tsx`)
| Route | Purpose |
|---|---|
| `/dashboard` | Stats + recent trades |
| `/journal` | Full trade table with chart thumbnails |
| `/journal/new` | Create trade (TradeForm) |
| `/journal/[id]/edit` | Edit trade with existing chart preview |
| `/analytics` | By-pair / session / emotion / setup-grade / strategy aggregations |
| `/challenges` | Active + history, create new |
| `/leaderboard` | `?mode=quality` or `?mode=earners`, signed avatars |
| `/profile` | Display name, visibility, starting balance, avatar upload, balance resets list, referrals |
| `/admin` | Server-side gated by `requireAdmin()` redirecting non-admins to `/dashboard` |

---

## Server actions

All mutations go through Server Actions (no client `_sb.from(...).insert(...)` ever). Each action:
1. Calls `requireUser()` (or `requireAdmin()` for admin actions)
2. Parses + validates form data with Zod
3. Calls Supabase with the user's session — RLS enforces ownership
4. Adds explicit `.eq("user_id", user.id)` on writes (defence-in-depth)
5. `revalidatePath()` for any affected route

Action inventory:

| File | Actions |
|---|---|
| `app/(auth)/actions.ts` | loginAction, signupAction, logoutAction, requestResetAction, setNewPasswordAction |
| `app/(app)/actions.ts` | createTradeAction, updateTradeAction, deleteTradeAction, setTradeVisibilityAction |
| `app/(app)/profile/actions.ts` | updateProfileAction (also handles avatar upload) |
| `app/(app)/balance/actions.ts` | createBalanceResetAction (atomically updates profiles.starting_balance) |
| `app/(app)/challenges/actions.ts` | createChallengeAction, setChallengeStatusAction, deleteChallengeAction |
| `app/(app)/admin/actions.ts` | adminPurgeUserDataAction (also cleans up storage objects before calling RPC) |

---

## Auth flow

1. `@supabase/ssr` `createBrowserClient` reads/writes the session **cookie** (not localStorage like the old app).
2. `lib/supabase/middleware.ts` refreshes the access token on every request.
3. Server Components and Server Actions use `supabaseServer()` which reads the same cookie — Postgres sees `auth.uid()`, RLS works end-to-end.
4. `(app)/layout.tsx` calls `getUser()` and redirects to `/login` if no session.
5. `(app)/admin/page.tsx` additionally calls `requireAdmin()` (which calls the `is_admin()` RPC).

---

## Cutover from the static app

The old static `index.html` SPA at the repo root loaded Supabase JS in the browser, kept tokens in localStorage, and read profiles + trades anonymously (RLS was disabled before this rebuild). The rebuild left the static files in place for rollback insurance, and writes from the new Next.js app populate **both** the new columns (`visibility`, `chart_path`, `avatar_path`) **and** the legacy columns (`trade_visibility`, `image_url`, `avatar_url`). This means a Vercel rollback to "Root Directory unset" would resurrect the static app reading correct data.

In ~1 week of stable cutover, run a final migration `0012_drop_legacy_columns.sql` to:
- Drop `profiles.avatar_url`, `profiles.name` (use `display_name` everywhere)
- Drop `trades.image_url`, `trades.trade_visibility`
- Stop the dual-write in `app/(app)/actions.ts` and `profile/actions.ts`
- Delete `index.html`, `js/`, `css/`, `assets/`, `manifest.json` from repo

---

## Vercel configuration

| Setting | Value |
|---|---|
| Root Directory | `web` |
| Framework Preset | Next.js |
| Build Command | (auto from preset) `next build` |
| Output Directory | (auto) `.next` |
| Install Command | (auto) `npm install` |
| Production Branch | `main` |
| Environment Variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production + Preview) |
| **Never in Vercel** | `SUPABASE_SERVICE_ROLE_KEY`, DB password, PAT |

Anything outside `web/` is silently ignored by Vercel — old static files stay in the repo without affecting deploys.

---

## CI

`.github/workflows/ci.yml`:
- Runs on push to `main` and on every PR
- Node 20, npm ci
- Steps: typecheck, build
- Uses dummy `NEXT_PUBLIC_*` env vars (no real secrets)

Vitest privacy + rendering suites are not yet wired into CI because the privacy suite needs a staging Supabase project. To run locally:

```bash
cd web
SUPABASE_SERVICE_ROLE_KEY=... npm test
```

Without the service-role key, the privacy spec self-skips (9 tests skipped, rendering 2 pass).

---

## Operational runbook

### Apply a new migration
```bash
PGPASSWORD='<DB password>' \
  /opt/homebrew/opt/libpq/bin/psql \
  "postgresql://postgres.awvrylniqppybwaiwzse@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require" \
  -v ON_ERROR_STOP=1 \
  -f supabase/migrations/0012_*.sql
```

Or via Dashboard SQL editor: paste contents, Run.

### Promote a user to admin
```sql
insert into public.admin_users (user_id, note)
values ('<auth.users.id>', 'why this user');
```
Never via API — `admin_users` has no INSERT policy.

### Smoke-test a deploy
```bash
curl -sS https://journal.bigmarkt.co/login | grep "ENTER THE MARKET"
curl -sS https://journal.bigmarkt.co/p/<community-profile-id> | grep "PUBLIC TRADES"
curl -sS "$URL/rest/v1/profiles?select=email" -H "apikey: $ANON" | jq length    # must be 0
```

### Rollback
1. Vercel dashboard → Settings → Build and Deployment → Root Directory → clear → Save
2. Trigger redeploy. Static `index.html` is now the deploy.
3. The legacy columns are still populated, so it reads correct data.

### Local dev
```bash
cd web
cp .env.example .env.local      # fill in values
npm install
npm run dev                     # http://localhost:3000
```

---

## Security invariants (acceptance tests)

These are the things the rebuild guarantees. Each maps to a verification we ran during the rebuild.

1. **Anonymous clients cannot read profiles/trades base tables** → `curl -H "apikey: $ANON" /rest/v1/profiles` returns `[]`. Verified after Slice 1.
2. **No email addresses appear in any anon HTTP response** → `grep -i "@gmail" $(curl ...)` returns empty on `/p/[id]`, leaderboard RPC, public profile RPC. Verified after Slice 4.
3. **User-generated text renders as text, not HTML** → React text rendering pinned by `tests/rendering.spec.tsx`. Manually verified Slice 2 with stored `<img onerror=alert(1)>` payload.
4. **Trade screenshots and avatars never have permanent public URLs** → buckets are `public = false`, only signed URLs minted server-side, TTL 1h. Verified Slice 3 + Slice 4.
5. **Admin operations require server-side `is_admin(auth.uid())`** → no client allowlist anywhere; admin nav link is cosmetic, the gate is on the page + the RPC. Verified Slice 5.
6. **Cross-user data is unreachable** → user A reading user B's trades returns `[]`; user A trying to update user B's profile affects 0 rows. Pin in `tests/privacy.spec.ts` (skipped without staging env, manually verified live).
7. **Schema lives in version control** → 11 migrations, all idempotent, applied to prod. Fresh staging project + migrations 0001..0011 produces an identical schema (post Slice-5 codex fix).
8. **Admin "Purge" deletes all of a user's public.* data** → trades, balance_resets, challenges, profiles, plus storage objects (charts + avatar). The `auth.users` row remains for platform-level deletion via dashboard.

---

## Known follow-ups

| Priority | Item |
|---|---|
| Low (1 week) | `0012_drop_legacy_columns.sql` — drop `trade_visibility`, `image_url`, `avatar_url` once cutover stable |
| Low | Delete static files (`index.html`, `js/`, `css/`, `assets/`, `manifest.json`) once legacy columns dropped |
| Low | Run `npm test` against a staging Supabase project (creates 9 currently-skipped privacy tests) |
| Low | Generated Supabase types (`supabase gen types typescript`). Currently blocked on Docker requirement; manual `lib/types.ts` mirrors prod accurately |
| Backlog | Edge Function for full `auth.users` deletion (admin "Purge data" currently leaves the auth row) |
| Backlog | Streak / badge automation in `challenges` (columns exist, no logic yet) |
| Backlog | Domain pre-warm / fewer-cold-start cache strategy |

---

## Build chronology (2026-05-09 / 2026-05-10)

| Slice | Commit | Scope |
|---|---|---|
| 1 | `a773adf` | Security foundation: Next.js scaffold, auth pages, migrations 0001-0004 (RLS, leaderboard RPC, storage policies), privacy + rendering tests |
| 2 | `a4d8266` | Trades CRUD UI; schema reconciliation (entry_price/exit_price/etc); migration 0005 (visibility backfill) |
| 3 | `b6e89d0` | Chart screenshots via private bucket + signed URLs; migration 0006 (chart_path column + backfill) |
| 4 | `13855be` | Leaderboard, public profile share page, profile settings; migrations 0007 (avatar_path), 0008 (get_public_trades RPC), 0009 (handle_new_user trigger) |
| 5 | `fb7ce28` | Server-side admin panel; migration 0010 (admin_overview, admin_recent_*, admin_top_pairs RPCs) |
| Cutover docs | `433b6bc` | CUTOVER.md with Vercel dashboard steps |
| Slice 6 | `a6a8754` | Analytics, challenges, balance resets |
| Polish | `f974174` | GitHub Actions CI, ConfirmButton, CompressedFileInput, Referrals UI |
| Codex fixes | `1daf1bc` | Rewrote 0001 to match prod schema, added migration 0011 (admin_purge_user_data with explicit deletes), fixed React import + flawed assertion in rendering test |
| Cutover | (Vercel dashboard) | Root Directory `web`, Framework Next.js, env vars set, redeploy 9JpDscBHo (54s) |

Total: 9 commits + 11 migrations + 1 Vercel reconfig from "old static SPA serving emails to anon clients" → "Next.js app with strict RLS, signed URLs, server-side admin, sanitized leaderboard, and a versioned schema."

---

*Last updated: 2026-05-10 after production cutover. Update when migrations land or routes change.*
