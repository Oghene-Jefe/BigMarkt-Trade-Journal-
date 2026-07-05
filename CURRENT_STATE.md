# BigMarkt — Current State

_Last updated: 2026-07-05. Update this file at the end of every session._

## What BigMarkt Is
Verified trade-journaling and social-trading platform for SMC/ICT retail traders. Live app at journal.bigmarkt.co. Broker data captured via a read-only MQL5 EA over an HMAC-signed bridge. Copy-trading and $BMT token are deliberately out of current build scope.

## Live Surfaces
- journal.bigmarkt.co — the app
- bigmarkt.co — marketing + blog
- fts.bigmarkt.co — FTS academy
- club.bigmarkt.co — club

## Stack
Next.js 15.5 / React 19 / TypeScript strict, Supabase Postgres (RLS), Tailwind, Vercel (auto-deploy on push to main). App code in `web/`. Supabase project ref: awvrylniqppybwaiwzse (eu-west-1). Repo: Oghene-Jefe/BigMarkt-Trade-Journal-, local clone C:\Users\User\bigmarkt.

## Migration State
- Applied in prod: 0001–0082 (0078 is an unused gap — never committed, harmless)
- 0079 — get_public_trades widened: trade_thesis added
- 0080 — get_following_feed widened: entry/exit/SL/TP, lot_size, session, setup_grade, trade_thesis, chart_path added
- 0081 — search_profiles RPC: community/public profile search by name/username, excludes caller, min 2 chars, capped 20, is_leader flag
- 0082 — two fixes in one migration: (1) pause now actually excludes a leader's trades from get_following_feed / get_following_open_positions (was `status <> 'cancelled'`, now `status = 'active'`); (2) get_following_open_positions no longer returns raw dollar `pnl` — swapped to `return_pct`, closing a gap the earlier privacy sweep missed
- 0083 — MetaApi scaffolding: metaapi_connections + metaapi_sync_runs tables (both RLS self-only, FKs cascade to auth.users + broker_accounts + metaapi_connections), and trades.capture_source CHECK widened to include 'metaapi'. Verified in prod: single capture_source check constraint present, all 4 FKs cascade-correct. Next migration is 0084.
- Migrations are applied MANUALLY in the Supabase SQL Editor — never `supabase db push`.

## Engagement Layer (C4) — Status

### C4a Reactions — SHIPPED
- trade_reactions table, RLS, three-reaction set: rocket / target / fire (🚀 🎯 🔥)
- Single reaction per user per trade (selecting a new one replaces the old; clicking your current one removes it)
- get_trade_reactions + toggle_trade_reaction: both SECURITY DEFINER with explicit visibility guards. Reader grants anon (counts visible on public trades); toggle requires auth.
- ReactionPicker.tsx — Telegram-style: collapsed by default, tap `+` to expand floating picker, animated. Replaces old ReactionBar.
- Cross-surface: feed, /@username, /p/[id] — one shared count, reacting from anywhere updates everywhere, persists on refresh.

### C4b Trade Thesis — SHIPPED
- `trade_thesis` column (migration 0079's predecessor added the column; 0079 widened the public RPC to return it)
- Public-facing rationale field, distinct from private `notes`. Editable even on EA-locked trades (context, not core).
- Write path: tradeSchema (lib/schemas.ts), createTradeAction/updateTradeAction (app/(app)/actions.ts), TradeForm.tsx textarea above Notes.
- Read path: get_public_trades (0079) and get_following_feed (0080) both return it.
- Rendered on: /@username profile, /p/[id] profile, and feed cards (TradeCard.tsx) — gold left-border, italic treatment. Guarded to only show when the trade itself is public (rides trade visibility, no separate gate).

### C4c Leader Content Layer — NOT STARTED
- Plan: closed-by-default content feed. Two tables — leader_posts (content) and content_access (gatekeeping with pending/approved/rejected). Both invite and request paths. Free now; payment later just becomes another way a row enters content_access (Phase D dependency).

## Discover / Profile Search — SHIPPED (this session)
- search_profiles(q) RPC (0081): SECURITY DEFINER, searches display_name/username via ilike, hard-filtered to community/public visibility only (never private), excludes caller, min 2-char query, capped 20 results, ordered exact-username-match → prefix-match → alphabetical. Returns is_leader flag (has an active_eligible or pro_eligible row in account_scores) for future filtering.
- /discover page + DiscoverSearch.tsx (client component, 300ms debounced search-as-you-type via searchProfilesAction in lib/actions/search.ts).
- Each result row: avatar, display name, @username, Leader badge if eligible, FollowButton — links to /@username.
- Nav: added as first item in the "Compete" dropdown group (DrawerNav.tsx), also appears first in the mobile drawer's flattened Compete section.
- Privacy verified: private profiles never appear in search results (confirmed via live test).

## Follow System Fixes — SHIPPED (this session)
- **FollowButton responsiveness bug (Discover page)**: root cause was that Discover's results live in client state, but the old FollowButton relied solely on `router.refresh()` (server-repaint only) to reflect a new follow — so the button never updated on Discover specifically (it worked fine on server-rendered surfaces like the leaderboard).
- Fix: FollowButton now maintains local optimistic state (`localSub`), flipping to "Following" immediately on a successful follow/unfollow/pause/resume, independent of router.refresh(). A useEffect still syncs from the `existingSubscription` prop when the parent DOES repaint (leaderboard, profile pages), so server-rendered surfaces stay authoritative.
- `followLeaderAction` (lib/actions/subscriptions.ts) now returns `subscriptionId` on success so the optimistic state has a real id to act on (pause/unfollow).
- **Pause now has a real effect**: previously Pause only changed a status flag with no visible behavior — paused leaders' trades still appeared in the feed. Fixed in 0082 (see Migration State above). Verified live: pausing a leader removes their trades from /feed; resuming restores them.

## Privacy Model (SHIPPED, refined this session)
- Raw dollar P&L (`pnl`) is NEVER returned to public surfaces — removed at the data layer in get_following_feed, get_public_trades, AND get_following_open_positions (this last one was a gap from the earlier sweep, closed in 0082).
- Public surfaces show `return_pct` PRIMARY, `rr_ratio` SECONDARY, fall back to WIN/LOSS.
- KEPT public: lot_size (broker-relative, plausible deniability, signals conviction), entry/exit, SL/TP, chart_path, trade_thesis (rides trade visibility).
- Owner's PRIVATE dashboard/journal still shows real dollars. Admin surfaces keep pnl (fraud detection, >$10k flag).
- Chart screenshots: a trader can choose to screenshot their own private detail view (including $ P&L) and upload it as their trade chart image. This is the trader's own choice about their own data — NOT a platform leak, since the platform's data layer never exposes it. No technical enforcement planned (OCR-based detection is impractical); addressed via user responsibility, not code.

## Feed (SHIPPED, enriched this session)
- /feed rebuilt (prior session): independent TradeCard components, "Live now" section for open positions above closed "Recent" trades.
- This session: TradeCard.tsx enriched — chart thumbnail (contained, `object-contain`, capped height, dark background — NOT full-bleed) and trade_thesis (gold left-border, italic) now render between the trade-hero block and reactions, closed-trades-only, both null-guarded. Open positions stay slim (no chart/thesis — those RPC fields aren't populated for open state).
- get_following_feed (0080) widened to carry entry/exit/SL/TP, lot_size, session, setup_grade, trade_thesis, chart_path — decision made to surface only chart + thesis on feed cards, NOT the full price grid (chart already shows entry/SL/TP visually; full detail lives on the profile page — feed teases, profile delivers).

## Guide Docs — PARTIAL LIVE
- `/guide` exists with a shared guide layout/nav and the first Getting Started pages: create account, onboarding, dashboard tour, and set up profile.
- `web/lib/guide/nav.ts` already lists the intended full guide IA, but most later guide routes are not implemented yet. Treat those links as planned docs, not completed help content, until matching `web/app/guide/.../page.tsx` files exist.

## EA Reconciler Bug — FOUND AND FIXED (this session)
- **Root cause found**: in `web/app/api/ea/ingest/route.ts`, `handleOpenSnapshot`'s step C ("CLOSE ORPHANS") marks a position `status: "closed"` the moment it vanishes from the broker's open-position snapshot — with NO attempt to look up the real close price/time first. If the EA's close-sweep (14-day rolling re-scan of broker deal history) doesn't independently catch the real close deal, the trade lands in the DB as `status: "closed"` with `exit_price: 0`, `close_price: NULL`, `pnl: 0`, `result: NULL` — a genuinely blank trade that rendered as an empty card on the public feed.
- This is a structural gap in the local-EA-polling architecture, not account-specific test noise — confirmed via trade_events audit (all 5 affected rows were `reconcile_closed` events with null price data, meaning the close was truly never witnessed, only inferred from absence).
- **Fix shipped**: step C now also sets `visibility: "private"` on these orphan-closed rows (can't fabricate a real result, so the trade stays honestly recorded in the owner's private journal but never surfaces incomplete on public feed/profile). Retroactively applied to the 5 existing broken rows in prod (verified: 5 rows updated).
- **This is the argument for MetaApi**: broker-API ingestion (pulling closed-deal history server-side from the broker, not just local-terminal event listening) would close this gap at the root, since it isn't dependent on the local MT5 terminal staying online/connected to witness every close event.

## Key Files
| What | Where |
|---|---|
| Reaction picker | web/components/ReactionPicker.tsx |
| Trade card (feed) | web/components/TradeCard.tsx |
| Feed page | web/app/(app)/feed/page.tsx |
| Feed data layer | web/lib/actions/feed.ts |
| Guide nav | web/lib/guide/nav.ts |
| Discover page | web/app/(app)/discover/page.tsx |
| Discover search component | web/components/DiscoverSearch.tsx |
| Discover data layer | web/lib/actions/search.ts |
| Follow button (optimistic state) | web/components/FollowButton.tsx |
| Follow/unfollow actions | web/lib/actions/subscriptions.ts |
| EA ingest endpoint | web/app/api/ea/ingest/route.ts |
| Public profile (@username) | web/app/(public)/[username]/page.tsx |
| Public profile (uuid) | web/app/p/[id]/page.tsx |
| Formatters | web/lib/format.ts (uses — for em-dash) |
| Scoring engine | web/lib/scoring.ts (ACTIVE_MIN_TRADES=30, ACTIVE_MIN_DAYS=30) |
| EA download | web/public/downloads/BigMarkt_EA_v2.7.1.ex5 |

## Trades Table — Relevant Columns
Full anatomy exists: entry_price, exit_price, close_price, stop_loss/sl, take_profit/tp, lot_size, pnl, rr_ratio, r_multiple, return_pct, balance_at_open, equity_at_open, account_currency, open_time, close_time, chart_path, trade_thesis, return_pct, verification_tier, status, source, verified, trust_badge.
- return_pct: EA-populated on close (via handleDealEvent's ENTRY_OUT path, computed from balance_at_open). NOT a generated/computed column — plain writable numeric, populated at write-time only. Confirmed NULL/unpopulated for open positions as of this session (no open EA trades existed to verify directly, but the column has no generation_expression, so population depends entirely on the EA/ingest write path reaching it).
- r_multiple: column exists, populated by SendDeal in the EA (computed from SL distance) when a real close deal is processed — NOT populated by the orphan-close path (no real deal data available there).

## Known / Deferred
- "Livelier reactions" = custom animated assets (Lottie/SVG) — future, not Unicode emoji.
- Orphan-closed trades (no real close data) are now private-only by design — see EA Reconciler Bug section above. Not a bug anymore, but still a data gap that MetaApi-style ingestion could close at the root.
- Discover results don't reflect real-time follow state for people you already follow (always shows "Follow" even if following — clicking again is harmless/idempotent via unique constraint, but not visually accurate). Low priority; would need a batch subscription fetch like the leaderboard does.

## MetaApi Integration — ENGINE BUILT (this session), last mile pending funding

Deriv MT5 capture note: Deriv MT5 (DMT5) is just another MT5 broker — captured via the SAME MetaApi path (investor-password stream) or the EA. No separate Deriv build exists or is needed for DMT5. Deriv NATIVE app contracts (Boom/Crash / synthetics / options in the Deriv app, not MT5) would need a separate first-party `profit_table` build — PARKED, only worth it if the community trades in the native app rather than DMT5. cTrader out of scope.

### Built & verified this session (all `npm run build` green)
- migration 0083 (applied in prod, verified)
- web/lib/metaapi/secrets.ts — reader-token envelope encryption (AES-256-GCM + HKDF, `server-only`, master key METAAPI_TOKEN_ENCRYPTION_KEY, HKDF info bound to (user_id, metaapi_account_id), no generate*() — MetaApi issues the token, we only encrypt it). Mirrors lib/ea/secrets.ts.
- web/lib/types.ts — MetaApiConnectionRow + MetaApiSyncRunRow appended.
- web/lib/metaapi/client.ts — READ-ONLY MetaStats REST client. GET-only by construction (no SDK, no trade methods). Region-scoped host `https://metastats-api-v1.{region}.agiliumtrade.ai`, `auth-token` header, timeout + retry + documented error-code mapping. Endpoints: historical-trades (updateHistory=true), open-trades. Defensive array coercion (historical wrapper key unconfirmed). Takes an already-decrypted token.
- web/lib/metaapi/normalize.ts — MetaStats trade → trades row. Reuses deriveEaResult/deriveEaDirection. CONSERVATIVE: only docs-confirmed fields mapped; sl/tp/return_pct/r_multiple LEFT NULL until live payload confirmed. metaStatsTimeToISO converts "YYYY-MM-DD HH:mm:ss.SSS" (UTC, space) → real ISO+Z. Returns both position_id and external_id (_id) so the writer picks the key.
- web/lib/metaapi/sync.ts — syncConnection(connectionId): pure function, one poll cycle for one connection. Loads connection, decrypts reader token, calls client, normalizes, upserts into trades on (user_id, position_id) — SAME key as EA (idx_trades_user_position_unique). Closed trade with NO position_id is logged+SKIPPED in v1 (counted). Opens a metaapi_sync_runs row (running→success/partial/failed), updates connection last_sync_at/last_error. trust_badge derived like the EA route. Writes visibility='private' (NO auto-share in v1). No orphan-close reconcile in v1. Uses supabaseAdmin() service-role client (import { supabaseAdmin } from "@/lib/supabase/admin"). Build fix applied: `const c = conn as unknown as ConnectionRow`.

### Design decisions locked
- MetaApi coexists with the EA (not a replacement). MetaApi = Pro tier differentiator (closes B3): "connect once, cloud-synced, no EA/VPS".
- MetaApi is a capture mechanism for a broker_accounts row (same relationship ea_tokens has) — so per-account scoring, dashboard filter, prop-firm lock, trust_badge, open-snapshot scoping all work for MetaApi trades for free.
- EA write model (direct to trades), NOT the Bybit staged-review model.
- Credentials: provision-then-DISCARD the broker investor (read-only) password; store only metaapi_account_id + encrypted reader-scoped token. Broker password never persisted.
- v1 = polling (Vercel cron), not streaming. Always-deployed for Pro-1 v1; undeploy-when-idle deferred to Max era.
- Read-only is STRUCTURAL: REST client has no mutating verb; no MetaApi SDK imported.

### Tier / pricing (Max DEFERRED — build only, verify economics later)
- Free: manual + self-hosted EA (zero marginal cost).
- Pro $15/mo: 1 cloud account (~$9/mo hosting deployed 24/7, or ~$0.75/mo undeployed-idle — 12× cheaper).
- Max $25/mo: DEFERRED. Cap = 0 seats for now (admin-configurable, prices fixed). 4 accts × ~$9 = underwater at $25 if always-deployed; undeploy-when-idle is the fix. Do NOT onboard Max users until economics verified against real MetaApi billing.
- MetaApi cost model confirmed from pricing page: API access FREE; hosting is what costs — deployed ~$0.0126/hr, UNDEPLOYED ~$0.00105/hr, plus $2.10/account/month to add. $10 minimum top-up + card/OTP blocked funding this session.

### NOT built yet (the last mile — needs a funded+deployed MetaApi account to test)
- Piece 4 — the cron: /api/cron/metaapi-sync, CRON_SECRET-gated, loops active connections calling syncConnection. DESIGN NOTE: build it undeploy-aware (deploy → poll → undeploy) to hit the ~$0.75/mo path.
- Provisioning UI — the connect-your-account flow (broker server + login + investor password → metaapi_connections row).
- Live probe (deferred, resolves 3 unknowns in one shot): (1) do CLOSED trades carry positionId? decides whether migration 0084 (external_id column) is needed; (2) `gain` field units → return_pct mapping; (3) SL/TP presence. Probe = read-only GET against one deployed MT5 account, run via Claude Code (not a shell curl), token via env var, never pasted.
- Field refinement pass: fill sl/tp/return_pct/r_multiple once the probe confirms shapes (likely via MetaApi RPC deals API — additive, columns already exist, no schema change).
- METAAPI_TOKEN_ENCRYPTION_KEY env var: NOT set yet — generate with `openssl rand -base64 32`, add to Vercel Production+Preview when provisioning is built.

### Blocker
- MetaApi funding: $10 minimum top-up + card OTP verification deferred. Everything through the sync writer is built and green; cron + UI + probe + refinement all want a live account to verify against. Decision when resuming: fund MetaApi and finish the last mile live in one push, OR build cron + UI blind now and test when funded.

## Build Queue (priority order)
1. **MetaApi integration — last mile** (engine built this session, see MetaApi Integration section above). Remaining: fund account → cron (piece 4, undeploy-aware) → provisioning UI → live probe → field refinement. Blocked only on MetaApi funding.
2. C4c leader content layer (biggest remaining C4 piece; pay-gating waits on Phase D)
3. B3 plan enforcement — deferred until MetaApi gives Pro a real feature
4. Phase D — Payments + MetaApi (D1 Paystack/Flutterwave, D2 MetaApi ingestion, D3 native Deriv/cTrader)
5. Admin-configurable scoring gates
6. More blog posts (crypto/stock/SMC/funded-trader keyword clusters)
7. Onboard founding leaders (non-code GTM step)
8. **Verified Trade Replay** (PARKED roadmap — post-launch, post-MetaApi last mile). Scope = #1 ONLY: replay a user's OWN logged trades on-chart — plot verified entry/exit/SL/TP + timestamps over historical candles, step through the price action. NOT #2 (bar-by-bar practice backtester like Forex Tester — separate heavy product, deferred indefinitely) and NOT #3 (rule/algo strategy backtesting — wrong audience, out of scope). Why it fits BigMarkt specifically: trades are broker-VERIFIED, so replay becomes a trust artifact, not just self-reflection — a leader's public profile could let followers replay a verified trade on the real chart, which no screenshot-based competitor can match. Leans directly into the "verified, not self-reported" thesis. Dependency: a historical CANDLE-DATA source (trades store entry/exit/SL/TP + times but NOT surrounding price bars). Synergy worth noting — MetaApi CAN return historical candles, so the same integration being built could feed replay (no separate data vendor needed). Open decisions when scoped: (a) candle source (MetaApi historical bars vs a free candle API); (b) where it lives — private journal enrichment (reflection) vs public profile (trust/social); the public/leader-profile version is the differentiated one. Rendering = a charting lib (e.g. Lightweight Charts) plotting trade markers over fetched candles. Moderate build, one external data dependency. NOT a pre-launch need.

## Hard Rules
- `npm run build` is mandatory before every push (tsc --noEmit misses hydration + typed-route errors).
- Migrations applied manually in Supabase SQL Editor, never `supabase db push`.
- RPCs: SQL Editor reporting "success" does NOT guarantee persistence — verify in pg_proc.
- PostgREST chokes on a returns-column named `count` (use `cnt`) and on ambiguous column names in plpgsql (qualify or alias).
- SECURITY INVOKER functions can hit NULL auth.uid() at RLS check time — use SECURITY DEFINER with an explicit visibility guard for write paths that need the caller's identity.
- The correct leaderboard scores table is `account_scores` (has a direct `user_id` column), not `leaderboard_scores` — that name doesn't exist.
- Never commit visa/audit docs (UK_EE_AUDIT.md is gitignored).
- No seed data in prod. Credentials never in code.

## Session Start Ritual
cd C:\Users\User\bigmarkt
git fetch origin && git pull --ff-only origin main && git status
cat CURRENT_STATE.md
