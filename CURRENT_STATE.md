# BigMarkt - Current State

_Last updated: 2026-07-03. Update this file at the end of every session._

## What BigMarkt Is
Verified trade-journaling and social-trading platform for SMC/ICT retail traders. Live app at journal.bigmarkt.co. Broker data is captured through the MQL5 EA and the HTTP `/api/ea/ingest` endpoint with HMAC signing/replay protection. Copy-trading and `$BMT` token functionality are deliberately out of current build scope.

## Live Surfaces
- journal.bigmarkt.co — the app
- bigmarkt.co — marketing + blog
- fts.bigmarkt.co — FTS academy
- club.bigmarkt.co — club

## Stack
Next.js 15.5 / React 19 / TypeScript strict, Supabase Postgres (RLS), Tailwind, Vercel (auto-deploy on push to main). App code in `web/`; public sites live in `sites/marketing`, `sites/fts`, and `sites/club`; EA presence/status service lives in `websocket-server`. Supabase project ref: `awvrylniqppybwaiwzse` (eu-west-1). Repo: `Oghene-Jefe/BigMarkt-Trade-Journal-`.

## Migration State
- Tracked migrations currently run through `0082_pause_hides_feed_and_open_positions_privacy.sql`.
- `0074` - `trade_reactions` table.
- `0075` - reaction RPCs (`get_trade_reactions`, `toggle_trade_reaction`) reconciled with prod.
- `0076` - `get_following_feed` returns `return_pct` instead of raw `pnl`.
- `0077` - `get_public_trades` returns `return_pct` instead of raw `pnl`.
- `0079` - `get_public_trades` includes `trade_thesis`.
- `0080` - `get_following_feed` includes entry/exit/SL/TP, lot size, session, setup grade, thesis, and chart path.
- `0081` - `search_profiles(q)` powers `/discover` profile search.
- `0082` - paused follows no longer show feed/open-position rows; `get_following_open_positions` returns `return_pct`, not raw `pnl`.
- Schema changes should be committed as migration files and applied with the Supabase CLI. See `docs/database-migrations.md`.

## Engagement Layer (C4) — Status
### C4a Reactions — SHIPPED
- trade_reactions table, RLS, three-reaction set: rocket / target / fire (🚀 🎯 🔥)
- Single reaction per user per trade (selecting a new one replaces the old; clicking your current one removes it)
- get_trade_reactions + toggle_trade_reaction: both SECURITY DEFINER with explicit visibility guards. Reader grants anon (counts visible on public trades); toggle requires auth.
- ReactionPicker.tsx — Telegram-style: collapsed by default, tap `+` to expand floating picker, animated. Replaces old ReactionBar.
- Cross-surface: feed, /@username, /p/[id] — one shared count, reacting from anywhere updates everywhere, persists on refresh.

### C4b Trade Thesis — SHIPPED
- Separate public-facing `trade_thesis` field, distinct from private `notes`.
- Public profile and following feed read paths include `trade_thesis` when the trade is visible.

### C4c Leader Content Layer — NOT STARTED
- Plan: closed-by-default content feed. Two tables — leader_posts (content) and content_access (gatekeeping with pending/approved/rejected). Both invite and request paths. Free now; payment later just becomes another way a row enters content_access (Phase D dependency).

## Privacy Model
- Raw dollar P&L (`pnl`) is not returned to public/community surfaces: `get_following_feed`, `get_public_trades`, and `get_following_open_positions` expose `return_pct` instead.
- Public surfaces show `return_pct` primary, `rr_ratio` secondary, and fall back to WIN/LOSS.
- Kept public when the trade itself is visible: lot size, entry/exit, SL/TP, chart path, setup/session fields, and `trade_thesis`.
- Owner's PRIVATE dashboard/journal still shows real dollars. Admin surfaces keep pnl (fraud detection, >$10k flag).
- Paused follows are privacy-preserving: only `subscriptions.status = 'active'` can surface a leader's following feed or open positions.

## Feed / Discover
- `/feed` uses shared `web/components/TradeCard.tsx` cards.
- "Live now" shows open EA positions from active follows via `get_following_open_positions`; closed "Recent" cards come from `get_following_feed`.
- Closed feed cards can show chart and thesis because the RPC now returns the enriched public-trade fields.
- `/discover` searches community/public profiles by display name or username through `search_profiles(q)` and supports follow/unfollow from results.

## Key Files
| What | Where |
|---|---|
| Reaction picker | web/components/ReactionPicker.tsx |
| Trade card (feed) | web/components/TradeCard.tsx |
| Feed page | web/app/(app)/feed/page.tsx |
| Feed data layer | web/lib/actions/feed.ts |
| Discover page | web/app/(app)/discover/page.tsx |
| Discover search action | web/lib/actions/search.ts |
| Public profile (@username) | web/app/(public)/[username]/page.tsx |
| Public profile (uuid) | web/app/p/[id]/page.tsx |
| Formatters | web/lib/format.ts (uses — for em-dash) |
| Scoring engine | web/lib/scoring.ts (ACTIVE_MIN_TRADES=30, ACTIVE_MIN_DAYS=30) |
| EA download | web/public/downloads/BigMarkt_EA_v2.7.1.ex5 |

## Trades Table — Relevant Columns
Full anatomy exists: entry_price, exit_price, close_price, stop_loss/sl, take_profit/tp, lot_size, pnl, rr_ratio, r_multiple, return_pct, balance_at_open, equity_at_open, account_currency, open_time, close_time, chart_path, trade_thesis, verification_tier, status, source, verified, trust_badge.
- return_pct: EA-populated (~10/22 trades currently). The privacy-safe % metric.
- r_multiple: column exists but EA does NOT populate it yet (0/22). Future EA task.
- rr_ratio: barely populated (~2/22), legacy field.
- equity_at_open / balance_at_open: per-trade account state (~11/22).

## Known / Deferred
- ~12 trades show blank magnitude (test data, null return_pct + null equity). Will self-populate as real EA trades flow in. Deliberately NOT backfilled.
- r_multiple unpopulated — EA should compute and write it (future EA task).
- "Livelier reactions" = custom animated assets (Lottie/SVG) — future, not Unicode emoji.
- Public feed/profile magnitude can still be blank for old/test data where `return_pct`, `rr_ratio`, and relevant equity inputs are null.

## Build Queue (priority order)
1. C4c leader content layer (biggest; pay-gating waits on Phase D)
2. B3 plan enforcement — deferred until MetaApi gives Pro a real feature
3. Phase D — Payments + MetaApi (D1 Paystack/Flutterwave, D2 MetaApi ingestion, D3 native Deriv/cTrader)
4. Admin-configurable scoring gates
5. More blog posts (crypto/stock/SMC/funded-trader keyword clusters)
6. Onboard founding leaders (non-code GTM step)

## Hard Rules
- `npm run build` is mandatory before every push (tsc --noEmit misses hydration + typed-route errors).
- Prefer committed migration files plus `supabase db push`; do not make untracked SQL Editor changes to prod.
- RPCs: SQL Editor reporting "success" does NOT guarantee persistence — verify in pg_proc.
- PostgREST chokes on a returns-column named `count` (use `cnt`) and on ambiguous column names in plpgsql (qualify or alias).
- SECURITY INVOKER functions can hit NULL auth.uid() at RLS check time — use SECURITY DEFINER with an explicit visibility guard for write paths that need the caller's identity.
- Never commit visa/audit docs (UK_EE_AUDIT.md is gitignored).
- No seed data in prod. Credentials never in code.

## Session Start Ritual
git fetch origin && git pull --ff-only origin main && git status

## Verification Commands
From `web/`:

```bash
npm run typecheck
npm test
npm run build
```

From `websocket-server/`:

```bash
npm run build
npm test
```
