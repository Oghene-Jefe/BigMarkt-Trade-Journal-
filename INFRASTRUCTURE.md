# BigMarkt Trade Journal — Infrastructure

Single source of truth for what's deployed, where, and why. Covers the full ecosystem — journal app, marketing sites, EA, WebSocket server, Bybit proxy, schema.

Started as a Next.js rebuild of a static SPA in May 2026. Has since grown into four Next.js apps + an MT5 Expert Advisor + a WebSocket server + a Cloudflare Worker, all backed by one Supabase project with **39 migrations**.

---

## Live URLs

| Surface | URL | What lives there |
|---|---|---|
| Journal app | https://journal.bigmarkt.co | Authed trading journal, leaderboard, broker connections, EA setup |
| Marketing | https://bigmarkt.co | Protocol / token / ecosystem |
| Academy | https://fts.bigmarkt.co | Bootcamp, warroom, course material |
| Campus club | https://club.bigmarkt.co | Student trader chapters, application |
| Supabase | https://awvrylniqppybwaiwzse.supabase.co (eu-west-1) | Backend for the journal |
| Bybit egress proxy | Cloudflare Worker (private URL) | Routes Bybit traffic around geo-blocks |
| WebSocket server | private host | Real-time EA heartbeat status |
| GitHub | https://github.com/Oghene-Jefe/BigMarkt-Trade-Journal- | Single monorepo |

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework (journal) | Next.js 15.5 + React 19 + Turbopack | App Router, RSC, Server Actions |
| Framework (sites/*) | Next.js 16.2.6 + React 19.2.4 | Marketing / FTS / Club; each its own deploy |
| Language | TypeScript 5.6, strict | |
| Styling (journal) | Tailwind 3.4 | Gold/black BigMarkt brand tokens; CSS-var theming for light/dark |
| Styling (sites/*) | Tailwind v4 | Per-site `@tailwindcss/postcss` |
| Icons | `lucide-react` 1.16 | Across `web/` and all three `sites/*` — no emoji in operational UI |
| Auth | Supabase Auth via `@supabase/ssr` | Cookie-based; RLS auto-applies |
| Database | Supabase Postgres | 39 versioned migrations in `supabase/migrations/` |
| Storage | Supabase Storage, private buckets | Signed URLs only, no permanent public links |
| Validation | Zod | Shared client + server schemas |
| Tests (journal) | Vitest 3.x | Unit suites; one privacy suite hits real Supabase |
| Tests (ws-server) | `tsx --test` (node:test) | Pure-logic tests for `parseTokenIds` |
| CI | GitHub Actions | typecheck + test + build on push |
| Hosting | Vercel | All four Next apps deploy independently |
| Bybit proxy | Cloudflare Worker | Token-gated egress for the journal's Bybit traffic |
| Realtime | Custom Node/`ws` server | EA WebSocket heartbeat + trade push; deployed to Railway |
| Trade ingest | MT5 Expert Advisor (MQL5) | Pushes fills to the journal as they happen |
| News cron | Vercel cron + Forex Factory XML | Daily Mon→Sun + next-week economic calendar |

---

## Repository layout

```
BigMarkt-Trade-Journal/                    ← monorepo root
├── INFRASTRUCTURE.md                       ← this file
├── CUTOVER.md                              ← initial Vercel cutover guide
├── README.md                               ← legacy README
├── SESSION_5_COMPLETE.md                   ← session log
├── .github/workflows/ci.yml                ← typecheck + test + build
├── index.html, js/, css/, assets/, manifest.json   ← LEGACY static app, not deployed
│
├── supabase/migrations/                    ← 28 SQL files, idempotent, additive
│
├── infra/
│   └── bybit-proxy-worker.js               ← Cloudflare Worker (egress proxy)
│
├── mql5/
│   └── BigMarkt_EA.mq5                     ← MT5 Expert Advisor source
│
├── websocket-server/                       ← Node + ws server (Railway-hosted)
│   ├── package.json, tsconfig.json, railway.json
│   ├── BRING_ONLINE.pdf                    ← shareable runbook for the team
│   ├── RAILWAY_DEPLOY.md                   ← full deploy + verify walkthrough
│   ├── .env.example
│   ├── src/{server.ts, statusQuery.ts, types.ts}
│   └── tests/statusQuery.test.ts           ← node:test via `tsx --test`
│
├── sites/                                  ← Three independent Next.js marketing apps
│   ├── marketing/                          ← bigmarkt.co
│   ├── fts/                                ← fts.bigmarkt.co
│   └── club/                               ← club.bigmarkt.co
│   (each has its own /public/favicon-{dark,light}.svg + lucide-react +
│    SocialLinks component + ecosystem footer; tailwind v4)
│
└── web/                                    ← The journal app (journal.bigmarkt.co)
    ├── package.json, tsconfig.json, tsconfig.typecheck.json, next.config.mjs, tailwind.config.ts
    ├── .eslintrc.json                       ← next/core-web-vitals + @typescript-eslint
    ├── middleware.ts                       ← session refresh + @username rewrite + onboarding gate
    ├── app/
    │   ├── layout.tsx, page.tsx, globals.css
    │   ├── (auth)/                           ← login, signup, reset, callbacks
    │   ├── (app)/                            ← all authed routes (see Routes)
    │   ├── (public)/[username]/              ← public profile by slug
    │   ├── p/[id]/                           ← public profile by UUID (legacy)
    │   ├── onboarding/                       ← post-signup wizard
    │   ├── auth/callback/route.ts            ← OAuth/email-link exchange
    │   └── api/
    │       ├── ea/ingest/route.ts            ← EA bearer-token trade ingest
    │       └── cron/
    │           ├── recalculate-scores/       ← daily 02:00 UTC score recalc
    │           └── news-feed/                ← daily 00:00 UTC Forex Factory ingest
    ├── lib/                                  ← see Module Inventory (includes lib/news/)
    ├── components/
    │   ├── ui/                              ← shared design primitives (Button, Section,
    │   │                                       StatusPill, EmptyState, PageHeader,
    │   │                                       MetricCard, EcosystemFooter, SocialLinks,
    │   │                                       Logo, …)
    │   ├── analytics/, brokers/, heatmap/, reportCard/, support/, trade/
    ├── docs/EXCHANGE_SECURITY.md             ← Bybit credential encryption design
    ├── tests/                                ← Vitest specs (includes news-forexFactory)
    ├── public/                              ← favicon-{dark,light}.svg + apple-touch-icon
    └── scripts/                              ← one-off tsx smoke/seed/news scripts
```

---

## Database schema (39 migrations)

Migrations are **idempotent and additive**. Re-applying any of them against the live schema is a safe no-op (notice messages only). Detailed table-by-table column reference lives in the original write-up; this index links each migration to what it shipped.

### Core (Slice 1)
| # | Purpose |
|---|---|
| 0001 | Baseline schema for `profiles`, `trades`, `balance_resets`, `challenges`, `admin_users` matching the original static app's prod schema |
| 0002 | Strict RLS — anon reads nothing from base tables |
| 0003 | `get_leaderboard(mode, lim)` SECURITY DEFINER RPC; no email returned, respects visibility |
| 0004 | Private storage buckets (`avatars`, `trade-charts`) with per-user path policies |

### Privacy + storage hardening (Slices 2–4)
| # | Purpose |
|---|---|
| 0005 | Backfill `trades.visibility` from legacy `trade_visibility` |
| 0006 | `trades.chart_path` for signed-URL minting |
| 0007 | `profiles.avatar_path` (private bucket replacement for `avatar_url`) |
| 0008 | `get_public_trades(profile_id)` for `/p/[id]` share page |
| 0009 | Trigger ensures every signup creates a `profiles` row |
| 0010 | Admin RPCs (`admin_overview`, `admin_recent_*`, `admin_top_pairs`) |
| 0011 | `admin_purge_user_data(target_id)` — explicit cascade-style delete, leaves auth.users |

### Trust + journal modes (Sessions 1–3)
| # | Purpose |
|---|---|
| 0012 | `profiles.journal_mode`; `trades.{trust_badge, capture_source, core_fields_locked, auto_approved}` |
| 0012b | 5-table Bybit auto-journaling schema (`exchange_connections`, `_sync_runs`, `_closed_pnl`, `_fills`, `_import_mappings`) |
| 0013 | `profiles.username` slug + `followers_only` visibility option |
| 0014 | Drop hybrid mode — `journal_mode` constrained to `'manual' \| 'automated'` only |
| 0015 | `profiles.tos_automation_accepted_at` |

### EA / broker auto-capture (Sessions 4–7)
| # | Purpose |
|---|---|
| 0016 | `broker_submissions` — anonymous user submissions of unlisted brokers |
| 0017 | `ea_tokens` — bearer tokens for the MT5 EA (sha256-hashed) |
| 0018 | `trades.{mt_ticket, mt_account, …}` + unique upsert index for EA dedupe |
| 0019 | `ea_connection_log` — WS connect/disconnect audit trail |
| 0020 | `broker_accounts` table; `account_type` enum (`live`/`demo`/`prop_firm`) |
| 0021 | `ea_tokens.broker_account_id` FK — one token per account |
| 0022 | Optional `broker_accounts.{account_number, readonly_password}` |

### Scoring + social + ops (Sessions 8–12)
| # | Purpose |
|---|---|
| 0023 | `account_scores` dual-tier (ACTIVE / PRO); `score_tier` enum (`none`/`active`/`pro`) |
| 0024 | `notifications.type` CHECK gains `new_follower` |
| 0025 | `get_platform_stats()` anon-callable aggregate counts for marketing homepage |
| 0026 | `bootcamp_applications` (used by fts.bigmarkt.co) |
| 0027 | `club_applications` (used by club.bigmarkt.co) |

### Session 9 — calendar, support, news, admin (0028–0031)
| # | Purpose |
|---|---|
| 0028 | `news_events` table for the Forex Factory economic-calendar feed; intended schema, but 0028's `CREATE TABLE IF NOT EXISTS` was a no-op against a pre-existing legacy shape — see 0037 |
| 0029 | `support_conversations` + `support_messages` for the in-app chat widget; RLS with admin override via `is_admin()` |
| 0030 | `brokers` + `leaderboard_overrides` admin-curation tables; `notifications.type` gains `announcement` for broadcast |
| 0031 | Notification triggers, challenge streak tracking, dispute resolution wiring, balance-reset score-recalc fix; rebuilds `notifications_type_check` (regressed `announcement` — see 0034) |

### Onboarding + audit-pass hardening (0032–0039)
| # | Purpose |
|---|---|
| 0032 | `handle_new_user` trigger reads `raw_user_meta_data.referred_by` so the `?ref=` query param on `/signup` lands on `profiles.referred_by` |
| 0033 | **Support-chat RLS hardening** — replaces the over-broad `users_own_messages` FOR ALL policy with explicit SELECT / UPDATE / INSERT. INSERT now checks `sender_id = auth.uid()` AND `sender_role = 'user'`, killing the admin-impersonation hole |
| 0034 | Restores `announcement` to `notifications_type_check` (regression from 0031). Final type list: 12 values including `trade_approved`, `challenge_badge`, `announcement`, etc. |
| 0035 | `mark_support_messages_read(p_conversation_id uuid)` SECURITY DEFINER RPC; drops the broad user UPDATE policy so users can only flip `read_at` on admin messages they own — never `body`/`sender_role`/`sender_id` |
| 0036 | `profiles_admin_select` policy — admins can SELECT cross-user profile rows for the support inbox + admin user-management surfaces (was silently returning NULL before, hence "Trader" placeholders) |
| 0037 | Aligns prod `news_events` with the schema 0028 *meant* to create: adds `title`/`forecast`/`previous`/`actual`/`updated_at`, relaxes `currency`/`impact`/`source` to nullable, adds the `UNIQUE (event_time, title)` constraint the cron upsert depends on, backfills `title` from legacy `event_name`. Legacy columns kept (no DROP) for safety. |
| 0038 | **Lock down `account_scores` writes.** Drops `scores_self_insert` and `scores_self_update` — any authed user could previously write rows where `user_id = auth.uid()` and climb the leaderboard via a raw REST call. Cron + manual recalc still work because they use service-role and bypass RLS. |
| 0039 | `news_events.url text` — added so the news cron can store Forex Factory's per-event permalink. UI prefers this over the Google News fallback when present. |

### Tables now in production
**Core**: `profiles`, `trades`, `balance_resets`, `challenges`, `admin_users`, `subscriptions`, `notifications`, `disputes`.
**EA / accounts**: `ea_tokens`, `ea_connection_log`, `broker_accounts`, `broker_submissions`, `account_scores`.
**Bybit (hidden feature)**: `exchange_connections`, `exchange_sync_runs`, `exchange_closed_pnl`, `exchange_fills`, `exchange_import_mappings`.
**Applications**: `bootcamp_applications`, `club_applications`.
**Session 9**: `news_events` (Forex Factory feed), `support_conversations`, `support_messages`, `brokers` (admin curation), `leaderboard_overrides`, `badges`.
**Sanitized view**: `profiles_public`.

All FK-cascade from `auth.users` on delete; all base tables have RLS enabled. Writable tables have **self-only** policies, except where an explicit admin override exists (support_*, profiles SELECT). Service-role writes bypass RLS by design.

---

## Routes (web/app/)

### Public (no auth)
| Route | Purpose |
|---|---|
| `/` | Marketing landing for the journal app — hero, feature cards, leaderboard preview, ecosystem cards |
| `/login`, `/signup`, `/reset`, `/reset/confirm` | Auth flows |
| `/auth/callback` | Supabase email/OAuth code exchange |
| `/onboarding` | Post-signup wizard (gated by `display_name is null`) |
| `/p/[id]` | Public profile share by UUID (legacy) |
| `/(public)/[username]` | Public profile by username slug — `/@alice` rewrites here via middleware |

### Authed (under `(app)/`, gate in middleware)
| Route | Purpose |
|---|---|
| `/dashboard` | Stats + recent trades + onboarding banners + monthly heatmap pulse |
| `/journal`, `/journal/new`, `/journal/[id]/edit` | Manual trade CRUD; NEWS tab renders the 14-day Forex Factory window grouped by day, 20/page |
| `/trades`, `/trades/[id]` | Trade list + detail view (separate from journal — single-trade focus) |
| `/analytics` | Equity curve, drawdown, win-rate-by-{pair, session, setup}, psychology advisor, weekly/monthly report cards |
| `/challenges` | Active + finished challenges; streak tracking |
| `/calculator` | Position-size / risk calculator (Trading dropdown) |
| `/leaderboard` | Pro Traders / Active Traders tabs |
| `/subscriptions` | People you follow + signal feed |
| `/brokers` | Broker directory + unlisted submission form |
| `/accounts`, `/accounts/[id]` | Broker accounts list + detail with `account_scores` panel |
| `/ea-setup` | 5-step token + install flow; live WS status card (filtered to user's own tokens) |
| `/exchanges`, `/exchanges/new` | Bybit API key management — **gated behind `requireAdmin`** for UAT (see Hidden features) |
| `/profile` | Display name, visibility, balance resets, referrals, avatar |
| `/notifications` | Inbox (follows, disputes, score-tier changes, announcements, trade-approved, challenge-badge) |
| `/disputes/new` | Raise a dispute on a trade |
| `/admin` | Server-side gated admin dashboard |
| `/admin/users`, `/admin/trades`, `/admin/disputes`, `/admin/support`, `/admin/support/[id]`, `/admin/leaderboard`, `/admin/brokers`, `/admin/broadcast` | Admin sub-surfaces (all `requireAdmin` server-side) |

### API
| Route | Purpose |
|---|---|
| `/api/ea/ingest` | POST endpoint the MT5 EA pushes trades to; bearer-token auth via `ea_tokens` (sha256-hashed); uses service-role to bypass RLS by design |
| `/api/cron/recalculate-scores` | Daily 02:00 UTC; recomputes `account_scores`; `CRON_SECRET` gated (refuses to run if env is unset) |
| `/api/cron/news-feed` | Daily 00:00 UTC; fetches Forex Factory `thisweek.xml` + `nextweek.xml`, parses via `lib/news/forexFactory.ts`, upserts into `news_events`; `CRON_SECRET` gated |

---

## web/lib/ module inventory

### `lib/exchanges/`
- `types.ts` — Bybit types, encrypted-blob shape
- `crypto.ts` — HKDF-SHA256 + AES-256-GCM envelope encryption (Phase A)
- `bybit/signing.ts` — HMAC-SHA256; **proxy-aware** `bybitBaseUrl()`
- `bybit/client.ts` — REST client; **proxy-aware** with `X-BIGMARKT-PROXY-TOKEN`
- `bybit/normalize.ts` — string→number, ms→ISO conversions
- `bybit/permissions.ts` — readOnly + fund-movement deny validator
- `bybit/windows.ts` — ≤7-day window splitter for closed-PnL backfills
- `bybit/sync.ts` — paginated fetch + upsert with composite-key dedupe

### `lib/ea/`
- `normalize.ts` — MT4/MT5 EA payload → `trades` row (`buildEaTradeRow`, `deriveEaDirection`, `deriveEaResult`)

### `lib/news/`
- `forexFactory.ts` — shared parser used by both the Vercel cron route and the local `npm run news:run` script. Owns XML parsing (CDATA + self-closing tags), MM-DD-YYYY date parsing, Europe/London → UTC conversion (BST-aware via `londonUtcOffsetMinutes`), country → currency mapping, impact mapping, row normalisation, `<url>` extraction with http(s)-only validation. No Supabase / Next imports — dependency-free for unit tests.

### `lib/supabase/`
- `client.ts`, `server.ts`, `middleware.ts`, `admin.ts` (service-role, server-only)

### `lib/auth/`
- `require-user.ts` — `redirect("/login")` if no session

### `lib/actions/`
- `trades.ts`, `disputes.ts`, `ea-tokens.ts`, `notifications.ts`, `create-notification.ts`, `subscriptions.ts`, `scores.ts`, `notificationTriggers.ts`

### Top-level lib
- `admin.ts`, `analytics.ts`, `brokers.ts`, `challengeStreak.ts`, `export.ts`, `format.ts`, `heatmap.ts`, `reportCard.ts`, `schemas.ts`, `scoring.ts`, `scoring-recalculate.ts`, `storage.ts`, `types.ts`

### `components/ui/` (design primitives)
Introduced during the UI-hygiene pass. Shared across every authed page so styling stays consistent and additions don't drift back into one-off AI-template patterns.

- **Layout**: `PageHeader`, `Section`, `ActionBar`, `EcosystemFooter`, `Logo`
- **Inputs**: `Button`, `Input`, `Field`, `Select`
- **Display**: `StatusPill`, `MetricCard`, `EmptyState`
- **Brand**: `SocialLinks` (also mirrored into each `sites/*` independently)

Rules captured in `components/ui/README.md`: `rounded-md` / `rounded-lg` only, sentence case, lucide icons only, gold reserved for primary action, no inline style islands.

---

## EA (Expert Advisor) architecture

The primary auto-capture path. Bybit is supported but **EA is what most users will use** because it works with any MT4/MT5 broker, not just exchanges.

### Flow

```
User's MT5 terminal
   │
   │ BigMarkt_EA.mq5 captures every fill
   │
   ▼
POST /api/ea/ingest                                            (web/app/api/ea/ingest)
   │  headers: Authorization: Bearer <ea-token>
   │  body: { mt_ticket, symbol, direction, open_time, ... }
   │
   ├── token sha256-lookup against ea_tokens (revoked? expired?)
   ├── service-role client (bypasses RLS by design — no user cookie)
   ├── buildEaTradeRow() normalises payload
   └── upsert into trades on (user_id, mt_ticket, mt_account)
        ├── trade_visibility: defaults from profile
        ├── trust_badge: 'verified'
        ├── capture_source: 'ea'
        └── core_fields_locked: true   ← user can't tamper with these fields
```

### Realtime status
The user's MT5 EA also opens a WebSocket to `websocket-server/` for heartbeat + status. `ea_connection_log` records connect/disconnect events with timestamps. `/ea-setup` shows the connection's last-ping age.

### Token lifecycle
- Generate: `web/lib/actions/ea-tokens.ts` mints a random token, stores `sha256(token)` in `ea_tokens`, returns plaintext once
- Revoke: row stays for audit trail but `revoked_at` is set; ingest rejects
- One token per `broker_account` (since 0021)

### Why service-role for ingest
The EA has no Supabase session cookie — it's a desktop process posting from the user's home network. Service-role lets the ingest route write `trades` for whichever `user_id` the token resolves to, after authenticating the token itself. This is the **one** place in the app that bypasses RLS; documented and constrained.

---

## Bybit egress proxy

Vercel's serverless functions run in AWS regions that Bybit blocks (HTTP 403 from CloudFront). Solution: a Cloudflare Worker as egress proxy.

### Flow

```
Vercel Server Action (journal.bigmarkt.co)
   │  GET https://<worker>/{mainnet|testnet}/v5/...
   │  + X-BAPI-* signing headers
   │  + X-BIGMARKT-PROXY-TOKEN: <shared secret>
   ▼
Cloudflare Worker (infra/bybit-proxy-worker.js)
   │  - verifies X-BIGMARKT-PROXY-TOKEN against env.BYBIT_PROXY_TOKEN
   │  - rewrites path → api.bybit.com or api-testnet.bybit.com
   │  - forwards only [X-BAPI-API-KEY, X-BAPI-TIMESTAMP, X-BAPI-RECV-WINDOW, X-BAPI-SIGN, User-Agent]
   │  - cacheTtl: 0 — no caching of authenticated responses
   ▼
api.bybit.com / api-testnet.bybit.com (responds normally — CF is allow-listed)
```

### Env wiring
`web/lib/exchanges/bybit/signing.ts`'s `bybitBaseUrl(env)` returns `BYBIT_{MAINNET,TESTNET}_BASE_URL` if set, else the direct host. So you can run unproxied locally (`unset` the var) and proxied in prod by setting it. Same code path either way.

### Vercel env vars
```
BYBIT_MAINNET_BASE_URL=https://<worker>/mainnet
BYBIT_TESTNET_BASE_URL=https://<worker>/testnet
BYBIT_PROXY_TOKEN=<shared secret>
```

### Worker env (Cloudflare side)
```
BYBIT_PROXY_TOKEN=<same shared secret>
```

---

## Sister sites

Three Next.js apps under `sites/`. Each is an **independent** Next project — its own `node_modules`, `package.json`, deploy. They share no code with `web/` or each other, by design (marketing iteration should never block journal work).

| Path | Domain | Pages |
|---|---|---|
| `sites/marketing/` | `bigmarkt.co` | `/`, `/ecosystem`, `/protocol`, `/token` |
| `sites/fts/` | `fts.bigmarkt.co` | `/`, `/about`, `/bootcamp`, `/warroom` |
| `sites/club/` | `club.bigmarkt.co` | `/`, `/about`, `/chapters`, `/join`, `/mentorship`, `/tracks` |

Application forms on `fts` and `club` insert into `bootcamp_applications` / `club_applications` (migrations 0026, 0027) via anon Supabase client — RLS allows anonymous inserts, admin-only reads.

### Shared visual identity across sites
- **Favicon**: each site ships `public/favicon-{dark,light}.svg` (the B + gold A glyph) wired via `metadata.icons` in `app/layout.tsx`. Default-icon entry is unconditional + two `prefers-color-scheme` variants for themed browsers. The scaffold `app/favicon.ico` files were deleted across all three sites — they were overriding `metadata.icons` via Next's file convention.
- **Logo**: each site has its own `app/_components/Logo.tsx` rendering `/images/bigmarkt-logo.png` with the `.bigmarkt-logo` class that picks up the `:root.light` filter trick (`invert(1) hue-rotate(180deg)`) so the white wordmark stays legible on light surfaces.
- **Lucide icons**: each site pins `lucide-react@^1.16.0` independently. FTS Boot Camp + pathways and Club "Six tracks" all use the same gold-tile motif (`h-10 w-10 rounded-md border-[#C9A84C]/30 bg-[#C9A84C]/10`).
- **Footer**: each site has a `SocialLinks` component mirroring the journal's, plus the shared ecosystem-link footer pattern.

---

## WebSocket server

`websocket-server/` is a tiny Node + `ws` ESM service hosted **on Railway** (see `RAILWAY_DEPLOY.md` and the shareable `BRING_ONLINE.pdf`). One HTTP server handles WS upgrades plus `/status` and `/healthz` on the same port — Railway injects `PORT`, the server reads `process.env.PORT ?? WS_PORT ?? 8080`.

### WebSocket connection
- Auth: each connection sends a bearer token; server sha256-hashes and looks up in `ea_tokens` via service-role
- On connect: inserts `ea_connection_log` row with `event='connected'`
- On disconnect: same with `event='disconnected'`
- `lastPing` tracked per connection; 60s staleness threshold
- Inserts incoming `TradePayload` messages into `trades` via service-role (same shape as `/api/ea/ingest`)

### `/status` endpoint (server-to-server only)
The journal's `/ea-setup` page polls `/status` to show "your EA is connected" + last-ping timestamps. The endpoint is **doubly gated**:

1. **`WS_STATUS_SECRET`** required as `Authorization: Bearer …`. Without it the WS server returns `503` (missing env) or `401` (bad bearer). Drops the CORS header too — this is not a browser-facing route.
2. **`?token_ids=uuid1,uuid2`** allow-list parsed by `src/statusQuery.ts`. The WS server filters `authedSockets` against this list **before** building the response. Missing or empty → returns zero connections. The server literally cannot leak the global active-connection map, even to a privileged caller.

`connected_clients` in the response is the filtered count, never a global tally. The journal supplies the calling user's active token IDs on every poll; rotating that list per user is the natural place to enforce per-user scoping since the WS server has no concept of "journal users."

### `/healthz`
Public, returns `200 ok`. Used by Railway's healthcheck.

### Tests
`tests/statusQuery.test.ts` — 9 cases for `parseTokenIds` (null/empty, single, comma list, dedupe, case, whitespace, 200-cap, junk rejection). Runs via `tsx --test` (`npm test`) with zero dev deps beyond `tsx`.

---

## RLS posture (with audit-pass hardening)

| Table | Policy |
|---|---|
| `profiles` | self-only SELECT/INSERT/UPDATE; admin SELECT override (`profiles_admin_select`, 0036) so admin support + user-management can see cross-user rows |
| `trades` | self-only CRUD |
| `balance_resets`, `challenges` | self-only |
| `subscriptions`, `notifications`, `disputes` | self-only on `user_id` |
| `exchange_*` (5 tables) | self-only on `user_id` |
| `ea_tokens` | self-only; `linkEaTokenToAccountAction` also runs an explicit ownership check on `broker_account_id` before linking |
| `broker_accounts` | self-only |
| `broker_submissions` | anon INSERT allowed, no SELECT/UPDATE/DELETE for anon (service-role only) |
| `bootcamp_applications`, `club_applications` | anon INSERT allowed, admin SELECT |
| `news_events` | authenticated SELECT (everyone reads); writes only via service-role cron |
| `account_scores` | **SELECT-only for users** (0038 dropped the writable policies — writes go through service-role cron / manual recalc which bypass RLS) |
| `support_conversations` | self-only + admin override (`admin_all_conversations`) |
| `support_messages` | SELECT self-only + admin override; INSERT requires `sender_id = auth.uid()` AND `sender_role = 'user'` (0033); UPDATE only via `mark_support_messages_read` RPC (0035) — never direct |
| `admin_users` | RLS enabled, no policies → no direct access; reads via `is_admin()` |
| Public discovery | `get_leaderboard`, `get_public_profile`, `get_public_trades`, `get_platform_stats` SECURITY DEFINER RPCs |

---

## Middleware (web/middleware.ts)

Three jobs, in order:

1. **`/@username` rewrite** — any path starting `/@` rewrites to `/<slug>` (the public profile route group)
2. **Session refresh** — `updateSession()` exchanges the cookie state with Supabase, writes refreshed tokens back
3. **Onboarding gate** — for paths under any app-route prefix (`/dashboard`, `/journal`, etc.), if `user` exists but `profile.display_name` is null, redirect to `/onboarding`

Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `/p/`, and image extensions.

---

## CI

`.github/workflows/ci.yml` runs on push to `main` + every PR:
- Node 20
- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run build`

With dummy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and a placeholder `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` (32 zero bytes) so the crypto suite has a valid master key.

Privacy spec (`tests/privacy.spec.ts`) self-skips without `SUPABASE_SERVICE_ROLE_KEY`. To run it, point a separate staging project at `npm test` with the real key.

---

## Tests

### `web/tests/` (Vitest)
| File | Pins |
|---|---|
| `bybit-signing.spec.ts` | HMAC-SHA256 signing matches openssl fixture; query canonicalization; header presence |
| `bybit-permissions.spec.ts` | `readOnly === 1` gate; fund-movement deny-list; empty-unknown-group allowed |
| `bybit-normalize.spec.ts` | String → number, empty → null, ms → ISO, raw preservation |
| `bybit-windows.spec.ts` | ≤7-day window splitter, contiguity, no-overshoot |
| `exchange-crypto.spec.ts` | Encrypt round-trip, no plaintext substring, tamper, wrong-user, wrong-salt |
| `ea-normalize.spec.ts` | MT buy/sell direction, EA trade row builder |
| `news-forexFactory.spec.ts` | MM-DD-YYYY parsing, BST/GMT offset flips on DST boundaries, 12:00am vs 12:00pm, Tentative/All Day fallbacks, self-closing tags, missing `<actual>`, unknown country, impact map, `<url>` parse + non-http rejection |
| `rendering.spec.tsx` | React text rendering escapes user content (XSS pin) |
| `privacy.spec.ts` | Real-Supabase RLS coverage (skipped without service-role) |
| `server-only-stub.ts` | Vitest helper that stubs the `server-only` package |

### `websocket-server/tests/` (node:test via `tsx --test`)
| File | Pins |
|---|---|
| `statusQuery.test.ts` | `parseTokenIds`: null/empty, single UUID, comma-list, lowercase, dedupe, whitespace trim, 200-cap, junk + SQL-fragment rejection |

---

## Operational runbook

### Apply a new migration
```bash
PGPASSWORD='<DB password>' \
  /opt/homebrew/opt/libpq/bin/psql \
  "postgresql://postgres.awvrylniqppybwaiwzse@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require" \
  -v ON_ERROR_STOP=1 \
  -f supabase/migrations/00XX_*.sql
```

Or paste into Supabase dashboard SQL editor.

### Bring a fresh staging project up to date
Run each migration file in order. **Never** concatenate them into a single
`_apply_all.sql`-style blob — that file has drifted before and silently
shipped incomplete schemas. The `.gitignore` enforces this.

```bash
for f in supabase/migrations/00*.sql; do
  echo "→ $f"
  PGPASSWORD='<DB password>' /opt/homebrew/opt/libpq/bin/psql \
    "postgresql://postgres.<ref>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require" \
    -v ON_ERROR_STOP=1 -f "$f" || exit 1
done
```

Or with the Supabase CLI (after `supabase link --project-ref <ref>`):

```bash
supabase db push
```

Both methods read `supabase/migrations/` directly and so cannot drift.

### Promote a user to admin
```sql
insert into public.admin_users (user_id, note)
values ('<auth.users.id>', 'why this user');
```

### Mint an EA token (for testing)
Use `/ea-setup` in the UI. Or via SQL:
```sql
-- Insert with sha256-hash of the secret you want
insert into public.ea_tokens (user_id, broker_account_id, token_hash, label)
values ('<user_id>', '<broker_account_id>', encode(sha256('your-token'::bytea), 'hex'), 'manual test');
```

### Smoke-test prod
```bash
curl -sS https://journal.bigmarkt.co/login | grep "Log in"
curl -sS "https://journal.bigmarkt.co/p/<community-profile-id>" | grep "Public trades"
curl -sS "$SUPABASE_URL/rest/v1/profiles?select=email" -H "apikey: $ANON" | jq length   # must be 0

# News-feed cron: requires CRON_SECRET — should 401 without and 200 with
curl -sS https://journal.bigmarkt.co/api/cron/news-feed
curl -sS -H "Authorization: Bearer $CRON_SECRET" https://journal.bigmarkt.co/api/cron/news-feed

# WS /status: requires WS_STATUS_SECRET AND ?token_ids=… (see RAILWAY_DEPLOY.md)
curl -sS -H "Authorization: Bearer $WS_STATUS_SECRET" https://<railway>/status
# → { connected_clients: 0, connections: [] }   ← empty because no token_ids supplied
```

### Backfill news manually
```bash
cd web
npm run news:run        # tsx scripts/run-news-cron.ts — uses the same shared parser
```

### Local dev (journal)
```bash
cd web
cp .env.example .env.local      # fill in values
npm install
npm run dev                     # http://localhost:3000
```

### Local dev (a sister site)
```bash
cd sites/marketing              # or sites/fts, sites/club
npm install
npm run dev
```

### Run sync against a real connection
```bash
cd web
node --import tsx scripts/smoke-sync.mts <connection_id>
```

### Run Bybit smoke (connect verification)
```bash
cd web
BYBIT_TEST_KEY=... BYBIT_TEST_SECRET=... \
  node --import tsx scripts/smoke-bybit.mts <user_id>
```

### Seed synthetic closed-PnL rows for UI work
```bash
cd web
node --import tsx scripts/seed-closed-pnl.mts <connection_id>
```

---

## Security invariants

The architecture preserves these across all changes:

1. **Anonymous clients cannot read profiles/trades base tables.** Verified after every migration that touches RLS.
2. **No email addresses in anon HTTP responses.** Public RPCs strip email; share pages render only `display_name`.
3. **User-generated text renders as text, never HTML.** Pinned by `rendering.spec.tsx`.
4. **Trade screenshots + avatars are never permanent public URLs.** Private buckets; signed URLs server-minted with 1h TTL.
5. **API credentials never stored in plaintext.** Envelope-encrypted with per-row salt + per-user HKDF info. `EXCHANGE_SECURITY.md` documents threat model.
6. **EA tokens never stored in plaintext.** Only `sha256(token)` lands in `ea_tokens.token_hash`.
7. **Admin operations require server-side `is_admin(auth.uid())`.** No client allowlist anywhere.
8. **Cross-user data is unreachable.** RLS + defence-in-depth `.eq("user_id", auth.uid())` on every mutation.
9. **Schema lives in version control.** 39 migrations, idempotent, applied to prod.
10. **Service-role key never imported from `app/` or `components/`.** Only `lib/supabase/admin.ts` exposes it, used by `/api/ea/ingest` (token-authed), the two cron routes, and `tests/privacy.spec.ts`.
11. **Cron + status endpoints fail closed on missing secrets.** `CRON_SECRET` unset → 500. `WS_STATUS_SECRET` unset → 503. Template-string bypasses (`Bearer undefined`) are no longer possible.
12. **`/status` cannot return the global active-connection map.** The WS server filters `authedSockets` against caller-supplied `?token_ids=…` before responding. Missing/empty → zero connections.
13. **Leaderboard scores cannot be self-written.** `account_scores` SELECT-only for users; writes only via service-role cron + manual recalc (0038).
14. **Support messages are immutable from the user side.** Users SELECT + INSERT (with `sender_role = 'user'`, `sender_id = auth.uid()`); only the `mark_support_messages_read` RPC flips `read_at` on admin messages.
15. **EA token → broker_account links are ownership-checked** in `linkEaTokenToAccountAction` before write. Belt-and-braces alongside RLS on `broker_accounts`.

---

## Sessions log (high-level)

| Session(s) | Theme | Highlights |
|---|---|---|
| Rebuild slices 1-6 | Foundation | Schema, RLS, signed URLs, leaderboard, admin, polish — see git log around `41d4ede` … `f974174` |
| Bybit Phases A-D | Auto-journaling | Schema, crypto, Bybit V5 client, connect flow, manual sync |
| Codex review | Hardening | Schema drift fix, admin_purge rename, test runtime fix |
| Session 1 | Trust + visibility | Trust badges, journal mode selector, per-trade visibility override |
| Sessions 2-3 | Public profiles + brokers | `/@username` routing, broker directory, broker submission, TOS modal |
| Session 4 | EA framework | `ea_tokens`, EA ingest route, MT5 EA file, EA setup UI |
| Session 5 | EA realtime | WebSocket server, heartbeat tracking, connection log |
| Session 6 | Trade detail | List page, detail page, journal mode indicator, RR auto-calc |
| Sessions 7-8 | Multi-account + scoring | `broker_accounts`, dual-tier ACTIVE/PRO scoring |
| Session 9 | Leaderboard rebuild | Pro/Active tabs, branded card design |
| Session 10 | Subscriptions | Follow system, subscriptions page |
| Session 11 | Social signals | Follow button, signal feed filter, news view |
| Session 12 | Disputes + notifications | Suspension triggers, dispute panel, notifications inbox |
| Sessions A-C | Stabilization | EA service-role swap, daily cron, notification auto-write, new_follower type |
| Session D | Mobile | Hamburger drawer, full mobile audit |
| Session E | Onboarding | Post-signup wizard, migration 0012 rename |
| Session F | Homepage refresh | Live stats RPC, leaderboard preview, ecosystem cards |
| Sessions G-I | Sister sites | bigmarkt.co marketing, fts.bigmarkt.co academy, club.bigmarkt.co campus |
| Latest 3 | Hardening | Verified trade edits, EA ingest + Bybit error stabilization, Bybit egress proxy |
| Session J — UI hygiene | Design system | `components/ui/` primitives + lucide-react across all surfaces; emoji removal sweep; sentence-case headings; favicon dark/light variants; ecosystem footer; theme bootstrap via `next/script` (kills the dark-flash); social links across all four sites |
| Session K — News tab | Forex Factory ingest | Migration 0037 aligns schema; cron + shared `lib/news/forexFactory.ts` with BST/GMT handling; 14-day window grouped by day; 20/page pagination; `<url>` permalink (0039); `npm run news:run` runner |
| Session L — Support chat | Customer support | Floating ChatWidget + admin inbox; migrations 0033 (insert-spoofing fix), 0035 (read-flag RPC), 0036 (admin profile SELECT for inbox names) |
| Session M — Audit pass | Launch-blocking fixes | Cron auth bypass (template-undefined), `account_scores` writable RLS (0038), broker_account ownership in EA token linking, WS `/status` secret + `?token_ids=` allow-list, FF event URLs (0039) |

---

## Hidden features

Features that are **built and deployed** but **not surfaced in the
nav**. They remain reachable by direct URL for ops + maintainers, and
all data + schema stays in place. Re-enabling is a 2-line code change
per item plus removing this row from the table when you do.

| Feature | Hidden because | What still works | What's hidden | Re-enable steps |
|---|---|---|---|---|
| **Bybit exchange connect + sync** | Not part of the current rollout — Bybit auto-journaling stays off while we focus the launch on the MT4/MT5 EA path. All code, schema, and Cloudflare Worker proxy stay in place for a later phase. | `/exchanges`, `/exchanges/new`, `/exchanges/[id]` routes; `exchange_connections` + 4 related tables; all Phase A–D code in `web/lib/exchanges/`; `connectBybitAction`, `syncBybitAction`, all RPCs and migrations 0012b/0017/etc.; Cloudflare Worker source in `infra/`; smoke scripts in `web/scripts/smoke-{bybit,sync}.mts` | "Exchanges" link removed from the Connect dropdown in `web/app/(app)/DrawerNav.tsx` (and from the mobile drawer, which derives from the same source) | (1) Deploy `infra/bybit-proxy-worker.js` to Cloudflare Workers and set `BYBIT_PROXY_TOKEN` secret. (2) Set `BYBIT_MAINNET_BASE_URL`, `BYBIT_TESTNET_BASE_URL`, `BYBIT_PROXY_TOKEN` in Vercel Production + Preview env. (3) Smoke-test from prod: `journal.bigmarkt.co/exchanges/new` with a real key. (4) Uncomment the `{ href: "/exchanges", label: "Exchanges" }` line in `DrawerNav.tsx` GROUPS array. |
| **Bybit imports review (`/journal/imports`)** | Depends on the Bybit feature above — both stay off until we light up exchange auto-journaling in a later rollout phase. | Route + UI fully functional; approving still creates `trades` rows + `exchange_import_mappings` links | "Imports" button removed from `/journal` header in `web/app/(app)/journal/page.tsx` | Restore the `<Link href="/journal/imports">Imports</Link>` button block. (Will likely re-enable together with the Bybit feature above.) |

---

## Known follow-ups

| Priority | Item |
|---|---|
| Low | Delete legacy static files at repo root (`index.html`, `js/`, `css/`, `assets/`, `manifest.json`) — Vercel ignores them but they clutter |
| Low | `/journal/imports` — review UX for `exchange_closed_pnl` pending rows; Bybit auto-import is currently sync-only with no UI to promote to journal trades |
| Low | Generated Supabase types via `supabase gen types typescript` — currently blocked on Docker requirement, `lib/types.ts` manual mirror is up to date |
| Backlog | Edge Function for full `auth.users` deletion (admin "Purge data" currently leaves the auth row) |
| Backlog | Streak / badge automation in `challenges` |
| Backlog | Performance score recalc as a Supabase trigger rather than a daily cron — would catch suspensions faster |
| Backlog | Drop the legacy `news_events` columns (`event_name`, `affected_pairs`, `notified`) — 0037 leaves them in place; safe to remove in a future migration once we've verified no environment has rows that still use them |
| Backlog | `apple-touch-icon.png` for the three `sites/*` (only the journal ships one currently); regenerate a 180×180 PNG from the new B+A SVG and drop into each `public/` |
| Backlog | Health-check widget on `/admin` showing "last news upsert", "last score recalc", "WS clients connected" — would surface stuck crons within a day instead of waiting for a user report |
| Backlog | `app/favicon.ico` scrub as part of any new `sites/*` scaffold (the file-convention override gotcha we hit with three sites at once) |

---

*Last updated: 2026-05-17 — refreshed to reflect 39 migrations, the audit-pass hardening (cron auth, account_scores RLS, WS `/status` secret + token allow-list), the news pipeline (shared parser + 14-day window + URL permalinks), the support-chat surface, the `components/ui/` design system, the ecosystem favicons and footer rollout, and the WS server's Railway migration. Keep in sync as future migrations land.*
