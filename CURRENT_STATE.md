# BigMarkt — Current State

_Last updated: 2026-09-19 (mobile app: release prep, EAS test builds, account deletion request, add account, opening screen; 2026-09-15 mobile app: Journal Stats, flat design, edit profile + photo; 2026-09-14 mobile app: login + tabs + read-only Home; 2026-09-13 repo audit + mobile kickoff; previous update 2026-07-12). Update this file at the end of every session._

## What BigMarkt Is
Verified trade-journaling and social-trading platform for SMC/ICT retail traders. Live app at journal.bigmarkt.co. Broker data captured via a read-only MQL5 EA over an HMAC-signed bridge. Copy-trading and $BMT token are deliberately out of current build scope.

## Live Surfaces
- journal.bigmarkt.co — the app
- bigmarkt.co — marketing + blog
- fts.bigmarkt.co — FTS academy
- club.bigmarkt.co — club

## Stack
Next.js 15.5 / React 19 / TypeScript strict, Supabase Postgres (RLS), Tailwind, Vercel (auto-deploy on push to main). App code in `web/`. Supabase project ref: awvrylniqppybwaiwzse (eu-west-1). Repo: Oghene-Jefe/BigMarkt-Trade-Journal- (PUBLIC). Local clones: C:\Users\User\bigmarkt (main dev machine); no permanent clone on the AEGEAN AJENO laptop yet. Mobile app (private repo Oghene-Jefe/bigmarkt-mobile): C:\Users\AEGEAN AJENO\Desktop\bigmarkt-mobile — see "Mobile App" below.

## Migration State
- Applied in prod: 0001–0085 per session notes (0078 is an unused gap — never committed, harmless). 0083 MetaApi tables, 0084 get_referral_list, 0085 MetaApi metrics columns — details below and in the MetaApi section.
- ⚠️ `public.notifications` is NOT created by any migration — it was made by hand before 0024; 0024/0030/0031/0034 only ALTER its CHECK constraint. A fresh/staging database cannot be rebuilt from supabase/migrations alone. See Repo Audit #3.
- 0079 — get_public_trades widened: trade_thesis added
- 0080 — get_following_feed widened: entry/exit/SL/TP, lot_size, session, setup_grade, trade_thesis, chart_path added
- 0081 — search_profiles RPC: community/public profile search by name/username, excludes caller, min 2 chars, capped 20, is_leader flag
- 0082 — two fixes in one migration: (1) pause now actually excludes a leader's trades from get_following_feed / get_following_open_positions (was `status <> 'cancelled'`, now `status = 'active'`); (2) get_following_open_positions no longer returns raw dollar `pnl` — swapped to `return_pct`, closing a gap the earlier privacy sweep missed
- 0083 — MetaApi scaffolding: metaapi_connections + metaapi_sync_runs tables (both RLS self-only, FKs cascade to auth.users + broker_accounts + metaapi_connections), and trades.capture_source CHECK widened to include 'metaapi'. Verified in prod: single capture_source check constraint present, all 4 FKs cascade-correct. No MetaApi-specific follow-up migration needed (the 0084 number was later used for get_referral_list) — live probe confirmed positionId present on closed trades, so MetaApi trades key on position_id exactly like the EA; no external_id column required.
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

## EA Reconciler Bug — FOUND AND FIXED (this session)
- **Root cause found**: in `web/app/api/ea/ingest/route.ts`, `handleOpenSnapshot`'s step C ("CLOSE ORPHANS") marks a position `status: "closed"` the moment it vanishes from the broker's open-position snapshot — with NO attempt to look up the real close price/time first. If the EA's close-sweep (14-day rolling re-scan of broker deal history) doesn't independently catch the real close deal, the trade lands in the DB as `status: "closed"` with `exit_price: 0`, `close_price: NULL`, `pnl: 0`, `result: NULL` — a genuinely blank trade that rendered as an empty card on the public feed.
- This is a structural gap in the local-EA-polling architecture, not account-specific test noise — confirmed via trade_events audit (all 5 affected rows were `reconcile_closed` events with null price data, meaning the close was truly never witnessed, only inferred from absence).
- **Fix shipped**: step C now also sets `visibility: "private"` on these orphan-closed rows (can't fabricate a real result, so the trade stays honestly recorded in the owner's private journal but never surfaces incomplete on public feed/profile). Retroactively applied to the 5 existing broken rows in prod (verified: 5 rows updated).
- **This is the argument for MetaApi**: broker-API ingestion (pulling closed-deal history server-side from the broker, not just local-terminal event listening) would close this gap at the root, since it isn't dependent on the local MT5 terminal staying online/connected to witness every close event.

## In-App User Guide — SHIPPED
- 35 pages live at /guide (journal.bigmarkt.co/guide), public route —
  excluded from Supabase auth middleware alongside /p/ (see
  web/middleware.ts matcher).
- Structure: web/lib/guide/nav.ts (10 sections), web/components/guide/
  GuideBlocks.tsx (shared content primitives: title, lead, steps, table,
  callout, related, next-link) and GuideShell.tsx (accordion sidebar —
  one section expanded at a time, auto-expands to the active page,
  collapses on mobile into a drawer).
- Every page interlinked via GuideNext — readable start-to-finish per
  section without touching the sidebar.
- Guide home (web/app/guide/page.tsx) is a landing page — one card per
  section with a single "Start here" link, not a full page listing (the
  sidebar owns full navigation).
- Discoverable: "Guide" is the first item in the Profile dropdown
  (DrawerNav.tsx) and mobile drawer, plus listed in EcosystemFooter.tsx.
- Content is audited against live code, not the older master-plan doc —
  documents only shipped features (excludes MetaApi UI, Bybit/exchanges,
  copy-trading — none are user-facing yet). Trust badges documented:
  auto_verified, manual, prop_firm, demo only (draft/edited exist as
  types but are never assigned in any write path).
- Leaderboard page includes the full scoring formula (weights, gates,
  every component calculation) pulled directly from lib/scoring.ts.
- Known gap found and fixed during this build: a Disputes page was
  drafted then removed — /disputes/new exists in code but nothing in the
  live UI links to it (no button on Following/FollowButton). Add the
  guide page back only once a real "Raise a dispute" entry point ships.

## Journal & Calculator Fixes — SHIPPED (2026-07-05)
- **XAU/USD pipValue bug fixed**: web/lib/pip-values.ts had pipValue: 10
  for XAU/USD; correct value (100oz/lot contract) is 1. Was overstating
  gold risk/lot-size by 10x in both the Risk Calculator and the Trading
  Constitution's risk-check engine (both read this same table). Verified
  live: $10,000 balance, 1% risk, entry 4000/stop 3990 now correctly
  recommends 0.10 lot (was previously ~0.01).
- **Manual trade entry unified with the shared instrument table**:
  TradeForm.tsx previously had its own hardcoded getPnlMultiplier()
  function, disconnected from pip-values.ts — correct for gold/silver by
  coincidence, but broken for standard forex majors (a single fallback
  multiplier of 10 that only worked for JPY pairs, off by ~10,000x for
  EUR/GBP/AUD-style pairs). Now uses findInstrument() from the shared
  lib. Verified live: EURUSD BUY, entry 1.0850, exit 1.0900, 1.00 lot →
  correctly auto-calculates to $500 P&L.
- **Pair field now has autocomplete**: TradeForm's Pair input was plain
  free text with no instrument list. Added a <datalist> sourced from
  ALL_INSTRUMENTS (web/lib/pip-values.ts) — suggests known pairs while
  still accepting free text for anything not in the list, so no existing
  manual entries break.
- **Heatmap cells now show trade count + P&L visibly**: previously this
  data (already computed per-day by lib/heatmap.ts's groupTradesByDay)
  was only shown via a native browser hover tooltip — invisible on
  mobile. Now rendered directly on each day cell (trade count top-right,
  abbreviated P&L bottom, e.g. "+1.2k").
- **Calendar split onto its own page**: MonthlyHeatmap moved out of the
  Journal page into /journal/calendar (web/app/(app)/journal/calendar/).
  Clicking a day navigates to /journal?date=YYYY-MM-DD, which
  JournalClient.tsx reads via a new initialDate prop to pre-filter the
  trade table — preserves the original click-to-filter behavior across
  the page split. Existing "Showing trades for [date] / Clear" banner
  logic untouched.
- **Shareable day-summary card added**: clicking a day on
  /journal/calendar now opens a modal card (web/components/heatmap/
  DaySummaryCard.tsx) showing that day's net P&L, trade count, and
  wins/losses — captured and shared via the same html-to-image
  toPng/toBlob pattern already used by ReportCardActions.tsx (Share and
  Download buttons, no new share mechanism introduced). The card
  includes a "View full trade list" link that routes to
  /journal?date=... (the filtering behavior from the earlier calendar
  split), and a Close button that dismisses without navigating.
  CalendarClient.tsx now manages an openDate modal-visibility state
  instead of navigating immediately on click.

## Key Files
| What | Where |
|---|---|
| Reaction picker | web/components/ReactionPicker.tsx |
| Trade card (feed) | web/components/TradeCard.tsx |
| Feed page | web/app/(app)/feed/page.tsx |
| Feed data layer | web/lib/actions/feed.ts |
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
| Risk calculator / instrument data | web/lib/pip-values.ts |
| Manual trade entry form | web/components/TradeForm.tsx |
| Heatmap day-cell aggregation | web/lib/heatmap.ts |
| Heatmap component | web/components/heatmap/MonthlyHeatmap.tsx |
| Calendar page (split from Journal) | web/app/(app)/journal/calendar/ |
| Day summary card (shareable) | web/components/heatmap/DaySummaryCard.tsx |
| Guide nav tree | web/lib/guide/nav.ts |
| Guide shared components | web/components/guide/GuideBlocks.tsx, GuideShell.tsx |

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

### ⚠️ PRE-LAUNCH REMINDER — Vercel Pro + cron frequency
> UPDATE (checked 2026-09-13): since undeploy-when-idle (commit 679ec65) the metaapi-sync cron no longer syncs trades — it only advances provisioning and undeploys idle accounts. Restoring `*/15` on its own will NOT bring back automatic sync; the scheduled deploy→sync→undeploy sweep must also be built. web/vercel.json still has 4 crons with metaapi-sync at `0 6 * * *`.

Current state (testing): metaapi-sync cron is set to DAILY (`0 6 * * *`) in web/vercel.json. This is a STOPGAP forced by the Vercel HOBBY plan, which only allows once-daily crons. The original design was every 15 min (`*/15 * * * *`), which the Hobby plan REJECTED and silently blocked the main app (big-markt-trade-journal) from deploying at all on 2026-07-10 — only fixed by dropping to daily (commit d46b3ff). Three sibling site projects deployed fine because they have no vercel.json/crons.

BEFORE onboarding real/public Pro users, MUST DO:
1. Upgrade Vercel from Hobby to PRO (~$20/mo). Removes the daily-cron limit and the 2-cron-per-account cap.
2. Change metaapi-sync schedule in web/vercel.json from `0 6 * * *` back to `*/15 * * * *` (every 15 min) — daily sync means a user's trades lag up to 24h, unacceptable for a live Pro feature.
3. Redeploy and confirm the main app builds green with the 15-min schedule.

WHY IT MATTERS: A Pro user expects trades to appear within minutes, not once a day. Daily is fine ONLY for solo testing with Jefe's own account. This is a hard pre-launch gate, tied to the Vercel Pro upgrade (not a code change beyond the one-line schedule edit).

ALSO NOTE: Hobby allows only 2 cron jobs total per account; web/vercel.json currently has 4 (news-feed, recalculate-scores, metaapi-sync, cleanup). Confirm in Vercel → big-markt-trade-journal → Settings → Cron Jobs whether all 4 are actually registered or if Hobby is silently capping at 2. If capped, that's a second reason Pro is required before launch.

### PROBE COMPLETE — verified against live account 2026-07-10
Ran read-only MetaStats probe against Jefe's real MT5 account (e6671a4e-eeb4-4e87-867f-0a9c52cf0f5e, region london, EGlobalTrade-Classic, MT5-20644000). Account funded via $5 MetaApi credit; MetaStats enabled on it (cost ~$0.00158/hr). Three unknowns RESOLVED:
- positionId IS present on closed trades → keys on position_id like the EA. NO migration 0084 needed.
- `gain` field IS the trade's percentage return (e.g. gain:-8.32 = -8.32%) → maps directly to return_pct (public-safe).
- SL/TP ABSENT from MetaStats model → stay null. Refine later via RPC deals API if wanted (additive, columns exist).
- Historical wrapper key confirmed = `trades`. Balance entries (DEAL_TYPE_BALANCE) present in history → must be filtered.

### Privacy audit — get_public_trades confirmed clean; other 5 RPCs verified via migration source this session
get_public_trades (0079, this repo) already redacts pnl→return_pct — no raw dollar value returned to anon/authenticated. Checked the other 5 named RPCs against their latest migrations in THIS repo this session (source-level check — no live pg_proc/DB session available, so this is verified against migration SQL, not a live query): get_following_feed (0082) and get_following_open_positions (0082) both return return_pct only, granted to authenticated only (not anon); get_public_profile (0046) and get_leaderboard (0047) return derived percentages only (growth_pct / win_rate / avg_rr) — pnl is consumed internally via SUM() but never returned as a column; search_profiles (0081) returns no dollar-shaped field at all, granted to authenticated only. NO raw pnl/profit/balance/equity leak found on any of the 6 in this repo. Note: an earlier audit turn this session correctly found get_public_trades DOES return raw pnl in a DIFFERENT, stale clone (C:\Users\User\bigmarkt-trade-journal) — that finding was accurate for that repo, not a false flag; the two repos share migration history through ~0047 and diverged afterward, and only this repo (bigmarkt) received the later 0077/0079 pnl→return_pct redaction. MetaApi trades inherit the redaction for free (write pnl to a private column, public RPCs surface return_pct).

### Built & verified this session (all npm run build green, PUSHED)
- web/lib/metaapi/normalize.ts UPDATED: isJournalableTrade() filter (skip DEAL_TYPE_BALANCE), gain→return_pct mapping. sl/tp/rr_ratio/r_multiple stay null.
- web/app/api/cron/metaapi-sync/route.ts NEW: 15-min cron, CRON_SECRET-gated via verifyCronAuth, loops metaapi_connections WHERE status='active', calls syncConnection. Mirrors recalculate-scores exactly. Read-only, no deploy/undeploy orchestration.
- web/vercel.json: added metaapi-sync cron (*/15 * * * *). Four crons total. — SUPERSEDED: dropped to daily `0 6 * * *` for the Hobby plan (commit d46b3ff), and since 679ec65 the cron no longer syncs.

### Cost model CONFIRMED (from live MetaApi screens)
- Deployed 24/7: $0.0126/hr hosting + $0.00158/hr MetaStats = $0.0268/hr ≈ ~$19.60/mo per account. UNDERWATER on $15 Pro.
- Undeployed-idle: ~$0.77/mo hosting + ~$1.15/mo MetaStats ≈ ~$2/mo per account. Healthy on $15 Pro.
- User pays $0 extra (operator absorbs MetaApi cost). One-time: $2.10 add + $0.0756 deploy.
- DECISION: build Option A cron simple/deployed NOW (test only, keep account undeployed between tests to save credit); add undeploy-when-idle automation as a LATER piece before real Pro users. Max tier stays deferred (cap 0).

### Provisioning BACKEND — SHIPPED 2026-07-11 (commit 8f4f842, fire-and-poll, Option A)
Decisions RESOLVED this session:
- Fire-and-poll CHOSEN: server action writes the metaapi_connections row as 'provisioning' and returns fast; the metaapi-sync cron advances provisioning→active.
- Token model CORRECTED — Path A (ONE shared reader token) SUPERSEDES the earlier per-connection encrypted-reader-token design (any note above about minting + encrypting a token per connection is obsolete). Why: MetaApi can only mint EXPIRING narrowed tokens (24h default) and only via SDK — there is no permanent per-account REST token. Since every provisioned account lives under BigMarkt's ONE MetaApi user and MetaStats reads are scoped by accountId in the URL, a single long-lived read-scoped token (env METAAPI_READER_TOKEN, narrowed ONCE by hand in the MetaApi web UI to metastats-api + reader) reads them all. Consequences: metaapi_connections.reader_token_* columns stay NULL; web/lib/metaapi/secrets.ts is now UNUSED (left in place, harmless); METAAPI_TOKEN_ENCRYPTION_KEY is no longer needed.
Corrected MetaApi provisioning contract (verified against live docs — earlier notes here were wrong): Create POST /users/current/accounts needs {login, password(investor), name, server, provisioningProfileId, magic:0, application:'MetaApi'} — NO 'platform' field; provisioningProfileId REQUIRED → 201 {id} only. State comes from GET /users/current/accounts/{id} → state (DEPLOYING→DEPLOYED / DEPLOY_FAILED) + connectionStatus (DISCONNECTED→CONNECTED) + region (MetaApi assigns it; we persist it) + metastatsApiEnabled. Enable: POST .../{id}/enable-account-features {metastatsApiEnabled:true} → 204 (paid, briefly stops account). Deploy: POST .../{id}/deploy → 204 (idempotent). Server validate/suggest: GET /known-mt-servers/5/search?query=.
Files shipped (commit 8f4f842, all npm run build green):
- web/lib/metaapi/provisioning.ts — write-scoped create/enable/deploy/readAccount/searchKnownServers client. GET-only reads; retries ONLY 429/5xx/network (never 400/401/403/404 — MetaApi bills excessive errors). Auth via METAAPI_PROVISIONING_TOKEN.
- web/lib/metaapi/sync.ts — MODIFIED: reads shared METAAPI_READER_TOKEN (Path A); per-connection decrypt + reader_token null-guard removed; no longer imports secrets.ts.
- web/app/(app)/accounts/metaapi-actions.ts — provisionConnectionAction: isAdmin() gate (TEMPORARY — swap for Pro entitlement in Phase D), IP rate limit (checkAndLog scope 'metaapi_provision', 10/hr, fail-closed), validate server → createAccount(investor pw) → insert broker_accounts (readonly_password NULL) → insert metaapi_connections status='provisioning' → discard pw. Rolls back the broker_account on provision failure; logs metaapiAccountId if the connection insert fails (orphan-cleanup trace). Security-reviewed: investor password never persisted or logged on any of the 3 exit paths.
- web/lib/metaapi/advance.ts — advanceProvisioning(connId): reads account state, persists region, enables MetaStats once DEPLOYED, flips to 'active' when DEPLOYED+CONNECTED+metastatsApiEnabled; DEPLOY_FAILED→'error'; transient read failures never flip.
- web/app/api/cron/metaapi-sync/route.ts — MODIFIED: two-phase — Phase 1 advances 'provisioning' rows, Phase 2 syncs 'active' rows (advance first so a just-activated account syncs the same run).

### REMAINING — Provisioning last mile (needs MetaApi FUNDING to test live)
- Bit 3 — UI: "Connect via cloud (Pro)" form in web/app/(app)/accounts/AddAccountModal.tsx calling provisionConnectionAction (fields: label, broker_slug, account_type, server + suggestions, login digits-only, investor password; handle serverSuggestions + confirm_unknown_server resubmit; show the 'provisioning' pending state). Gate the button to admins in the UI too (mirror the action gate) so non-admins never see it.
- Bit 4 — Vercel env + one-time setup (NONE set yet): METAAPI_PROVISIONING_TOKEN (write-scoped, provisioning only), METAAPI_READER_TOKEN (read-scoped metastats-api + reader, narrowed once in the MetaApi web UI, long/max validity), METAAPI_MT5_PROVISIONING_PROFILE_ID (create ONE MT5 provisioning profile once, reuse for all accounts). METAAPI_TOKEN_ENCRYPTION_KEY NOT needed under Path A.
- Live probe: fund MetaApi, provision Jefe's own account through the UI, watch the cron advance provisioning→active, confirm trades sync.

### Provisioning LIVE PROBE — SUCCESS 2026-07-11 (supersedes the "REMAINING — last mile" section above)
Full end-to-end verified in prod: UI form → provision → advance → MetaStats sync → real trades in journal, badged "Cloud".
- Commits: 6a074a5 (Connect-via-cloud UI, admin-gated), 0b1e65a (provisioning profile made OPTIONAL), 21f9635 (createAccount now sends platform:'mt5' — REQUIRED by MetaApi in the no-profile path; this was the missing field that first blocked create), 98ea867 (journal SourceBadge: added source='metaapi' → blue "Cloud" badge; was mislabeled "Manual"). Backend 8f4f842 / doc d79d998 earlier same day.
- NO provisioning profile needed: MetaApi auto-detects the broker from the server name (MT Profiles list is empty yet accounts work). METAAPI_MT5_PROVISIONING_PROFILE_ID stays optional/unset. createAccount MUST include platform:'mt5' when no profile is passed.
- Env vars set in Vercel (Production+Preview), both tokens made via MetaApi → API Access → Generate token, validity UNLIMITED (so NO rotation needed — this fully resolves the Path A token-expiry concern):
  - METAAPI_PROVISIONING_TOKEN = "Trading account management API", Read-write, all methods/all entities.
  - METAAPI_READER_TOKEN = "MetaStats API" only, Read-only, all methods/all entities.
  - METAAPI_TOKEN_ENCRYPTION_KEY NOT set (not needed under Path A). CRON_SECRET was rotated this session (saved separately).
- Probe run: connected Jefe's real login 20644000 (EGlobalTrade-Classic) through the UI. Row written 'provisioning'; advanced via a MANUAL cron trigger because the Hobby cron is daily: `curl -H "Authorization: Bearer $CRON_SECRET" https://journal.bigmarkt.co/api/cron/metaapi-sync`. First runs returned activated:0 (still DEPLOYING, ~few min); then {"activated":1,"succeeded":1,"imported":38,"skipped":6,"total":1}. Trades render in the journal with the blue "Cloud" + verified badge.
- Server-validation flow confirmed: a wrong server (EGlobalTrade-Classic-MT5) returned suggestions including the correct EGlobalTrade-Classic; picking it succeeded.
- KNOWN (test artifact, NOT a bug): the probe used Jefe's REAL login 20644000, which already had journal data (some manual, some with charts). Sync upserts on (user_id, position_id), so colliding position_ids UPDATED pre-existing rows and re-pointed their broker_account_id to the new cloud account (chart_path/notes/thesis preserved — enrich-not-duplicate). A fresh user/login won't hit this. For a PURE-cloud re-test, clear this login's old trades or use a clean login.
- CLEANUP PENDING: (1) delete the duplicate MetaApi account created for 20644000 (a 2nd one alongside existing e6671a4e) — undeploy/delete to save credit; (2) delete the two stray MANUAL test broker_accounts made by mistake ("EXNESS CLOUD TEST", "eglobal cloud test"); (3) revoke old read-only probe tokens.

### Provisioning ENHANCEMENTS + UI POLISH — SHIPPED 2026-07-12
- Accounts UI on true-black brand: modals (Add/Edit/CloudConnect) bg-gray-900→bg-panel + bg-black/40→bg-bg; accounts page.tsx + [id]/page.tsx canvas bg-gray-900→bg-bg (the blue-cast culprit); journal Cloud badge sky→gold; delete-confirm rebuilt as a CENTERED dialog (ConfirmButton.tsx, replaced the anchored popover); cloud modal success emerald→win. Commits cb41a33 / f623687 / 593970b. bg-gray-900 was ONLY in the accounts area app-wide (grep-confirmed) — no broader sweep needed.
- STILL BLUE (not yet fixed): ScoreCard.tsx "Verified pro" badge (bg-blue-500) on the account detail page — recolor to gold/pro when convenient.
- Prop-firm CLOUD journaling ENABLED (commit 36f52ff): provisionConnectionAction sets journal_mode='automated' for ALL cloud connections incl. prop firms; is_prop_firm stays true (keeps prop_firm badge + deferred copy-execution lock). Hard Rules clarified. Prop-firm reassurance note in CloudConnectModal (593970b).
- Broker/server AUTOCOMPLETE — SHIPPED (commit d899c77): searchServersAction (admin-gated, wraps searchKnownServers, deduped/capped 12) + CloudConnectModal live debounced (300ms, min 2 chars) dropdown on MT5 Server, auto-seeded from the picked broker's name. The free-text + submit-validation + confirm-unknown fallback stays intact.

### Cloud feature COMPLETIONS — SHIPPED 2026-07-12 (post-autocomplete)
- Admin trade oversight: Source column + filter (Manual/EA/Cloud) on /admin/trades — distinguishes broker-verified (EA/cloud) from self-reported (manual). Commit 83f21be.
- Accounts page: per-account Cloud connection status pill (Cloud · Live / Provisioning… / Error / Paused), driven by a metaapi_connections lookup keyed on broker_account_id. Commit 2e611b6.
- ScoreCard tier badges brand-aligned (pro->gold, active->win; were blue/emerald). Commit 6256d7e — resolves the earlier "ScoreCard STILL BLUE" note.
- "Sync now" button on cloud account cards (web/app/(app)/accounts/CloudSyncButton.tsx + syncNowAction in metaapi-actions.ts): owner-checked via RLS-scoped read; advances a 'provisioning' connection or syncs an 'active' one on demand — removes the wait for the daily Hobby cron / curl+CRON_SECRET. Reports "Synced — N imported". Commit 31c73e3.
Cloud feature is now end-to-end: provision (UI, admin-gated) -> fire-and-poll advance -> MetaStats sync -> status pill + Cloud badge + admin source visibility -> one-click Sync now. Remaining: undeploy-when-idle cost automation (deferred); Vercel Hobby->Pro + restore 15-min cron (pre-launch gate, still open).

### Undeploy-when-idle — SHIPPED 2026-07-12 (commit 679ec65)
Cost model concluded. MetaApi accounts now sit UNDEPLOYED by default (~$2/mo idle vs ~$19.60/mo deployed-24/7). On-demand cycle: the Sync now button (CloudSyncButton.tsx) polls cloudSyncStep (metaapi-actions.ts) every 5s → deploys the account → waits for DEPLOYED+CONNECTED → syncConnection → undeployAccount (back to idle). Button shows Deploying… / Connecting… / Syncing… / "Synced — N imported". New primitive undeployAccount() in provisioning.ts. Old syncNowAction REMOVED (superseded by cloudSyncStep).
Daily cron (api/cron/metaapi-sync) reworked: Phase 1 advance provisioning; Phase 2 COST-CLEANUP only — undeploys any 'active' account left DEPLOYED (just-activated or abandoned Sync-now). It NO LONGER syncs (a cron invocation can't wait the 1–3 min a deploy takes).
CONSEQUENCE: automatic scheduled sync is OFF on Hobby — data freshness is ON-DEMAND ONLY (user clicks Sync now) until Vercel Pro.
DEFERRED to Vercel Pro (pre-launch gate): the ~6h scheduled auto-sweep (a frequent cron drives the deploy→sync→undeploy state machine so users don't have to click). Pairs with the existing Hobby→Pro + restore-15-min-cron gate.
Edge/safety: if a user abandons a Sync mid-deploy, the account stays deployed until the daily cron's Phase 2 undeploys it — fine on Hobby; a deploying_since guard + frequent cleanup arrive with Pro.

### Referral leader dashboard — SHIPPED 2026-07-12 (commit caed44a; migration 0084)
- migration 0084 get_referral_list() RPC — SECURITY DEFINER, takes NO param (derives the caller's own code from auth.uid() base64, so no cross-user enumeration), granted to authenticated. Returns per referred profile: display_name, username (only when that profile is public, else null), is_public, joined_at, is_active (has >=1 trade). Applied + pg_proc-verified in prod (prosecdef=true, pronargs=0).
- profile/page.tsx fetches get_referral_list in its Promise.all; Referrals.tsx renders a "Who joined" list (name — linked if public, join date, Active/Joined badge) below the existing signup count, plus a "earn 5% when they go Pro" teaser.
- Referral CAPTURE already existed (0032/0064/0065 + refCodeFromId + get_referral_stats). This session adds the leader VISIBILITY layer only.
- PAYMENT-GATED (Phase D, NOT built): the actual 5% revenue-share payout — needs a subscription/plan model (which referral went Pro) + a referral_earnings ledger + payout via Paystack/Flutterwave. Same dependency as B3 pay-gating. Design paper-only when ready; wire when D1 payments land.

### Pro entitlement WIRED (B3-lite) — SHIPPED 2026-07-12 (commit 33c8932)
- The plan model (migration 0068: profiles.plan / plan_status / plan_renews_at / plan_source + lib/plan.ts isPro/requirePro/requireProForAction/isProForUser) was previously built-but-wired-to-nothing. Now wired.
- Admin can COMP Pro: grantProAction / revokeProAction (admin/actions.ts, service-role write, requireAdminForAction) set plan='pro' / plan_status='comp' / plan_source='admin_comp' (revoke → free/active/admin_revoke). UI: Grant Pro / Revoke Pro button + gold "Pro" badge on /admin/users. 'comp' is always-entitled per lib/plan.ts — no payment needed. Use for founding leaders / testing.
- Cloud connect gate changed from admin-ONLY to Pro-OR-admin: provisionConnectionAction, searchServersAction, and the CloudConnectModal render on /accounts all check isAdmin() || isPro(). Real B3 enforcement — MetaApi is now the Pro differentiator. RESOLVES the earlier "swap the TEMP admin gate for Pro entitlement" pre-launch item. (cloudSyncStep stays owner-checked only.)
- Still PAYMENT-GATED (Phase D): self-serve upgrade (Paystack/Flutterwave writes plan='pro' on successful payment). /upgrade is currently just a Pro waitlist (pro_interest_at). The referral 5% payout also waits on this.

### Cloud balance/growth + leaderboard inclusion — SHIPPED 2026-07-12
- Cloud trades now COUNT toward the leaderboard: scoring-recalculate.ts filter changed .eq('source','ea') -> .in('source',['ea','metaapi']) (both broker-verified; manual never counts). syncConnection triggers recalculateAccountScoreWithClient after every cloud sync. Commit 189a207.
- MetaStats getMetrics() added to client.ts (GET-only) — returns balance/equity/deposits/profit/gain/absoluteGain. Commit 3890cbe.
- migration 0085: metrics snapshot columns on metaapi_connections (balance, equity, deposits, profit, gain, metrics_updated_at). Applied + verified in prod (6 cols). Repo record commit 8b6bfb9.
- syncConnection captures the getMetrics snapshot (best-effort, non-fatal) into those columns on every sync. MetaApiConnectionRow type extended. Commit 3890cbe.
- Account detail page (/accounts/[id]) shows a "Cloud account" card: Balance / Growth% / Deposits / Profit + "Updated ..." (or a Sync-now prompt when unpopulated). Commit d9625ff.
- DESIGN: v1 uses the MetaStats account-level snapshot for headline numbers (EA stamps per-trade balance_at_open; MetaStats gives aggregates directly). The equity curve still runs on per-trade P&L (unchanged). DEFERRED: per-trade balance_at_open reconstruction for a real-balance equity curve; dashboard-level surfacing (currently on the account detail page only). Resolves the earlier "cloud balance/growth tracking" parked item.

### Cloud growth semantics + full-history + post-join leaderboard — SHIPPED 2026-07-12
- FULL HISTORY: sync.ts HISTORY_WINDOW_DAYS 30 -> 3650 (~10y) — cloud sync now pulls the account's full closed-trade history into the journal (dedup on position_id). Commit 4d15145. Heavier first sync for old accounts; refinement = full-first-then-narrow if it hits the ~5min CloudSyncButton poll ceiling.
- LEADERBOARD BOUNDARY (integrity): scoring-recalculate.ts counts only trades whose close_time is AFTER the user's join date (profiles.created_at) via .gt("close_time", joinDate). Pre-join history is journaled/shown but NEVER verifies a trader into Active/Pro. Uses close_time (not created_at) because backfilled trades all get a recent insert-time created_at. Commit 5dfa66b. Alt considered: account-connection date (stricter); chose join date per Jefe.
- DASHBOARD GROWTH = trading return: for cloud accounts the dashboard Growth tile = totalPnl / deposits * 100 (skill, deposit/withdrawal-independent, consistent with Net P&L + leaderboard). NOT MetaStats gain (dominated by cash flows). Commit 5c74baf. Learned via test account: deposits ~$917, balance $0.38, 38 trades netting only -$11.47 — the -97.8% gain was WITHDRAWALS, not trading loss; trading return ~ -1.25%.
- ACCOUNT DETAIL card shows the raw account-money snapshot: Balance / "Account gain" (MetaStats gain%) / Deposits / Profit — distinct label from the dashboard's trading-return "Growth". Commit 42c1b6f.
- KEY: MetaStats `gain` includes deposits/withdrawals — it is NOT a pure trading return. Use trade P&L / deposits for skill metrics; show gain only as the account snapshot.

### PRE-LAUNCH GATES (added 2026-07-11)
- RESOLVED 2026-07-12 (commit 33c8932): the TEMPORARY isAdmin() gate in metaapi-actions.ts is now Pro-or-admin. Self-serve paid Pro still waits on Phase D.
- Rate limit SHIPPED (10 provisions/hr/IP via abuse_log scope 'metaapi_provision'). Consider adding a per-user cap before broad launch.
- (Still stands) Vercel Hobby→Pro + restore metaapi-sync cron to */15 (see PRE-LAUNCH REMINDER above).

### Housekeeping deferred
- Revoke probe tokens in MetaApi API Access (read-only, low risk, but revoke).
- Delete stale clone C:\Users\User\bigmarkt-trade-journal (do via File Explorer, verify by eye — the stale one has NO web/lib/metaapi folder).
- Keep test account UNDEPLOYED between sessions to preserve $5 credit.

### Blocker — RESOLVED 2026-07-11
- MetaApi was funded and the live provisioning probe succeeded end to end (see "Provisioning LIVE PROBE — SUCCESS"). No open MetaApi blocker.

## Build Queue (priority order)
0. **ACTIVE (2026-09-13): Mobile app** — kickoff, see "Mobile App" section. Ordering of the items below vs mobile not yet decided.
1. ~~MetaApi integration — last mile~~ DONE 2026-07-11/12 (live probe, cloud UI, Sync now, undeploy-when-idle, Pro gate). Remaining: scheduled auto-sweep + Vercel Pro (pre-launch gate).
2. C4c leader content layer (biggest remaining C4 piece; pay-gating waits on Phase D)
3. B3 plan enforcement — LITE version WIRED 2026-07-12 (admin comp + cloud gated Pro-or-admin); self-serve upgrade waits on Phase D payments
3a. Repo Audit fixes (2026-09-12) — see "Repo Audit" section; #1–#3 are quick and should go before public launch
4. Phase D — Payments + MetaApi (D1 Paystack/Flutterwave, D2 MetaApi ingestion, D3 native Deriv/cTrader)
5. Admin-configurable scoring gates
6. More blog posts (crypto/stock/SMC/funded-trader keyword clusters)
7. Onboard founding leaders (non-code GTM step)
8. **Verified Trade Replay** (PARKED roadmap — post-launch, post-MetaApi last mile). Scope = #1 ONLY: replay a user's OWN logged trades on-chart — plot verified entry/exit/SL/TP + timestamps over historical candles, step through the price action. NOT #2 (bar-by-bar practice backtester like Forex Tester — separate heavy product, deferred indefinitely) and NOT #3 (rule/algo strategy backtesting — wrong audience, out of scope). Why it fits BigMarkt specifically: trades are broker-VERIFIED, so replay becomes a trust artifact, not just self-reflection — a leader's public profile could let followers replay a verified trade on the real chart, which no screenshot-based competitor can match. Leans directly into the "verified, not self-reported" thesis. Dependency: a historical CANDLE-DATA source (trades store entry/exit/SL/TP + times but NOT surrounding price bars). Synergy worth noting — MetaApi CAN return historical candles, so the same integration being built could feed replay (no separate data vendor needed). Open decisions when scoped: (a) candle source (MetaApi historical bars vs a free candle API); (b) where it lives — private journal enrichment (reflection) vs public profile (trust/social); the public/leader-profile version is the differentiated one. Rendering = a charting lib (e.g. Lightweight Charts) plotting trade markers over fetched candles. Moderate build, one external data dependency. NOT a pre-launch need.

## Repo Audit — 2026-09-12 (fresh clone at 774234d; all items OPEN)
Verified green: `npm run typecheck` clean, `npm test` 180 passed / 9 skipped (all 9 = privacy.spec.ts), `npm run build` green.

Solid — keep as is: RLS enabled on all 33 tables created in migrations; all 35 current SECURITY DEFINER functions set search_path; envelope encryption in lib/ea/secrets.ts (AES-256-GCM, HKDF bound to user+token, key versions); supabaseAdmin guarded by `server-only`; history scan found no service-role key or private API key committed.

Findings, priority order:
1. **CUTOVER.md is wrong about the service-role key.** Step 3 says do NOT add SUPABASE_SERVICE_ROLE_KEY to Vercel because it is "never imported". It is used by password reset and signup rate limiting ((auth)/actions.ts), the onboarding username check, admin actions, manual-trade violation recompute, all 4 crons, EA ingest and MetaApi sync. Prod clearly has it set (those features work) — fix the doc so nobody follows it on a new deploy.
2. **Dependencies.** `npm audit --omit=dev`: 6 vulns (1 critical, 3 high). next@15.5.18 — GHSA-2xp9-vwfh-vxw4 (Image Optimization AVIF RCE) applies on Vercel; GHSA-p293-qw3h-jr36 (the "critical") is Windows-hosted only. sharp 0.34.5 (libvips/libheif CVEs). `web/package.json` `overrides.postcss: "8.5.10"` pins a vulnerable postcss (fixed in ≥8.5.28) and blocks `npm audit fix`.
3. **notifications table not in migrations** (see Migration State). Capture its DDL + RLS policies + triggers from prod as a new migration.
4. **The only live RLS test never runs.** privacy.spec.ts self-skips without SUPABASE_SERVICE_ROLE_KEY and CI never sets one. Needs a staging Supabase project.
5. **CI covers web/ only.** websocket-server/ (has tests, holds the service-role key), sites/club, sites/fts, sites/marketing are never typechecked, built or tested.
6. **Guard workflows pass silently.** schema-drift.yml and supabase-policy-guard.yml exit green with a warning when their secrets are missing. Not confirmed whether the secrets are set; if drift really ran, #3 would fail it.
7. **Bot check can be skipped — do NOT fix by flipping the dashboard switch.** Turnstile runs only inside the Next.js signup/reset server actions; the public anon key can call Supabase Auth signUp directly. Supabase's own captcha setting (Auth → Bot and Abuse Protection) would close this, but `signupAction` does not pass a `captchaToken` to `auth.signUp`, so turning it on would BREAK live web signup. Needs a coordinated web change first. Matters for mobile too.
8. Low: an old anon JWT and the project ref are in git history (js/config.js). Anon keys are public by design and the current tree is clean — nothing to do beyond keeping RLS correct.
9. Low: the middleware `/@slug` rewrite turns `/@api/...` into `/api/...`, sidestepping the matcher's exclusions. Harmless today (API routes check their own auth) — don't add auth gating to middleware without closing this.
10. Low: broker_submissions allows anonymous INSERT with no rate limit (spam risk).
11. Low: web/app/api/ea/ingest/route.ts is 1,687 lines — split it next time it's touched.

Branches: 8 unmerged `automation/documentation-sync*` + `codex/documentation-sync` branches (Jun 27–Jul 20, 1 commit each, touching web/README.md, web/.env.example, docs/database-migrations.md, RAILWAY_DEPLOY.md) — review or delete. `feat/activation-flow` and `feat/security-hardening-batch-1` are fully merged — safe to delete.

## Mobile App — KICKOFF 2026-09-13
- Local project folder: C:\Users\AEGEAN AJENO\Desktop\bigmarkt-mobile (README.md = brief, docs/PLAN.md = phases + screen list, docs/backend-surface.md = what the app can call). Private GitHub repo: https://github.com/Oghene-Jefe/bigmarkt-mobile.
- No app store yet (owner, 2026-09-14): build and test locally only. Store IDs / Apple + Google developer accounts deferred.
- **TOP RULE (owner, 2026-09-13): mobile work must never affect the live web product.** No pushes to this repo's `main` for mobile work (every push to `main` redeploys production — no Vercel ignore step), no web code changes, no migrations or Supabase Auth/dashboard changes without explicit approval.
- DECIDED 2026-09-13: Expo (React Native) + TypeScript + @supabase/supabase-js against the SAME Supabase project (awvrylniqppybwaiwzse); separate repo, shared web logic copied not imported; signup/password reset open the website (login native); Phase 1 is read-only against live with private test accounts; a staging Supabase project is required before any write feature.
- Main backend constraint: the web app's writes go through Next.js server actions (27 "use server" files), which a mobile app cannot call. Mobile can use supabase-js directly for RLS-protected tables, the public RPCs and storage (avatars, trade-charts). Anything that needs Turnstile, abuse_log rate limits, the service role or third-party secrets (MetaApi, EA tokens, admin) needs server endpoints — likely `web/app/api/mobile/*` route handlers that authenticate with the user's Supabase access token.
- Still open: manual trade entry on mobile skips the service-role constitution-violation recompute (accept for v1 or add a server function later); Sync now for cloud accounts needs a server endpoint (web change, needs approval); user self-serve Delete account (check what exists on web before release).

### Mobile progress — 2026-09-14
- **Phase 0 DONE.** Expo SDK 57 + TypeScript + expo-router (`src/` layout), Supabase client (publishable key only, in gitignored `.env.local`; verified HTTP 200 against auth settings), shared web logic copied from web @ 774234d (`pip-values`, `format`, `heatmap`, `types`). Typecheck clean, expo-doctor 21/21.
- **Expo account linked.** CLI logged in as `bigmarkt`; project linked to expo.dev project `bigmarkt` under `bigmarkts-team` (projectId b276f723-e5f0-4a3b-bba0-06b8079ff5d7); app.json slug `bigmarkt`, owner `bigmarkts-team`. Note: `npx expo login --browser` crashes on Windows (Expo CLI passes the login URL unquoted to `cmd start`); use plain `npx expo login` (email + password) instead.
- **Mockups approved.** 22-screen design canvas (phone + tablet, 4 tabs / 11 screens + share trade card + loading/empty/offline states), audited and updated: https://claude.ai/code/artifact/6fd54c2f-2844-4410-8b3d-a89d1d730b51 (generator: `design/build-mockups.mjs`).
- **Phase 1 started: login flow built.** Session context, login screen (email/password, show/hide, generic error, Create account / Forgot password open the website), signed-in route group with guard, temporary signed-in screen with log out. Verified in the PC web preview (Expo web on localhost:8081); not yet tested with a real login or on a phone.
- **PC preview:** Expo web build (web output `single`; browser localStorage for the session on web, encrypted SecureStore on phones). Phone testing via Expo Go is pending.
- **Test account login verified (2026-09-14)** in the PC preview; the session persists across reloads.
- **Bottom tabs + Home built (read-only).** Home mirrors the web dashboard: active account read from profiles.active_broker_account_id with an in-memory fallback (never writes, unlike web getActiveAccount, which creates a default account and persists the choice); Net P&L, Growth (web cloud vs balance rules), Win rate, Total trades; open positions; recent trades; Cloud "Updated … ago"; local-only account picker; pull-to-refresh. Queries use explicit column lists (never broker_accounts.readonly_password or metaapi token columns). Journal and Community are placeholders; Me has log out. Typecheck clean.
- **Verified only against the empty test account** (all zero/empty states). A few trades on the test account are needed to check real numbers.
- **Journal tab built (read-only), 2026-09-14.** List mirrors web JournalClient/JournalTable (active-account scope, cancelled orders hidden, All/Cloud/EA/Manual chips with counts, pair search, date filter, month sections, rule-deviation counts). Calendar mirrors web MonthlyHeatmap (Sunday-start grid, getDayColor tiers, legend, month pulse) with a daily summary card and View trades. Trade detail mirrors web journal/[id] (open/pending/closed, owner-only Net P&L with the same price fallback, Return %, R:R via copied computeRR incl. No stop loss flag, rule deviations, price grid, thesis, notes, details). Charts load via an owner-signed Storage URL (trade-charts is private; storage RLS from migration 0004 lets owners read their own folder), so no web proxy or server change is needed. Lifecycle timeline omitted per the design audit.
- **Active account is shared** across Home, Journal and trade detail (src/lib/accounts.tsx), resolved like web getActiveAccount but never written back.
- **Verified in the PC preview against the test account's two manual trades:** Home (−$35 net, 50% win rate, 2 trades), Journal list and counts, XAUUSD detail (R:R 3.00 = 15/5), calendar day 14 (−$35), daily summary (2 trades, 1 win, 1 loss), View trades filter. Chart display not yet exercised (no chart uploaded on the test trades). A one-off browser 400/CORS error on the broker_accounts query did not recur after reload; the columns exist (migration 0057) and a live probe returns 200 with CORS headers.
- **Community tab built (read-only), 2026-09-14.** Feed (get_following_feed + get_following_open_positions; Live now / Recent; return % then R; trust badge; thesis; read-only reaction counts). Leaderboard (get_leaderboard_scores for All / Pro / Active with the web descriptions and verified-only notice; rank cards; read-only follow status). Your progress card reads the user's own account_scores row (verified trades / 30, days / 30, automated and live gates). Discover (debounced search_profiles). Trader profile (get_profile_by_username, get_public_trades, get_public_score, get_public_adherence, get_follow_counts). No dollar P&L on any Community screen. Follow / unfollow and reacting deferred to the write phase.
- **Storage limit found:** the avatars and trade-charts buckets are owner-read-only (migration 0004; no later storage policies), so a viewer can't sign another user's avatar or chart. The app uses initials and omits other traders' chart images. The web signs these with the viewer's session too, so other traders' avatars fall back to initials there as well, and public-trade charts through the /c proxy may be failing for non-owners. Worth checking on web; nothing changed from mobile.
- **Verified in the PC preview:** feed empty state (test account follows nobody); leaderboard empty (live RPC returns 0 rows for all, pro and active, so no scored leaders yet); progress card Not ranked yet 0/30 and 0/30; search "ma" finds @bigmarkt; trader profile for @bigmarkt and tap-through from Discover; private/missing profile message for /trader/jefe (jefe is not public). Traders without a username are not tappable yet (web opens those by id via get_public_profile, not yet mirrored).
- **Me tab built (read-only), 2026-09-14.** Profile card (own avatar via owner-signed URL, PRO badge using the web lib/plan.ts rule, visibility, follow counts, opens own public profile when community/public). Accounts with the web status pills (Live / Demo / Prop firm, Automated / Manual, Cloud Live / Provisioning / Error / Paused / Revoked, Inactive); tapping an account makes it the active account for Home and Journal, never saved back. Following list (own subscriptions, names via get_follow_list, Following / Paused). Settings (EA-trades-on-public-profile value, email, plan, privacy policy, guide, app version). Broker names from a map generated from web lib/brokers.ts.
- **Web findings from the Me tab (not changed from mobile):** (1) web settings/page.tsx decides "Show EA trades on public profile" by checking whether the first EA trade's visibility is "community", but trade visibility is private / public / exclude / followers_only, so the web toggle likely always shows Off. (2) There is no self-service account deletion on web (admin purge only), so the app can't offer Delete account yet; Apple requires it before any App Store release.
- **Verified in the PC preview with the test account:** Me (name, @username, Private profile, 0 / 0 follows, Personal account Live + Manual, active tick), Settings (Off, email, Free, links, BigMarkt 1.0.0), Following empty state. Typecheck clean.
- **Read-only phase (Phase 1) screens are now all built:** Login, Home, Journal (list, calendar, trade detail), Community (feed, leaderboard, discover, trader profile), Me (following, settings).
- **Tablet layouts built, 2026-09-14 (mobile commit 29b1e87).** At 768px wide and up: the tab navigator's built-in left side rail replaces the bottom bar; Journal shows the trade list (380px) on the left and the selected trade's detail on the right (trade detail is now one shared component used by both the phone screen and the tablet pane); Home shows the four metrics in one row, open positions beside this month's calendar, and recent trades three across. Phones are unchanged. Still read-only.
- **Verified in the PC preview** at 1180×820 (rail, wide Home, Journal split with EURUSD auto-selected and tap-to-switch to XAUUSD) and at 375×812 (bottom bar, list, tap opens the full trade screen). Typecheck clean. The browser 400/CORS console error on the broker_accounts query shows up again on full page reloads even though the data loads; it's worth a closer look later but doesn't block anything.
- **First real-device test (2026-09-14):** Android via Expo Go over the laptop's phone hotspot (LAN; the ngrok tunnel failed with "remote gone away") loaded and ran the app. iPhone Expo Go needs signing in as the `bigmarkt` Expo account first. A white band under the Android tab bar was fixed with a dark root background in app.json.
- **Write phase started (owner, 2026-09-14).** Decisions: free Supabase staging project; first write features = edit trade + chart upload, follow + reactions, add manual trade, profile edit + avatar; manual trades added from mobile accept the constitution-violation recompute gap for v1 (no server endpoint yet).
- **Staging database built and verified (2026-09-14):** `bigmarkt-staging` (ref qrqkawspdybjkcruvsdn, org BIGMARKT-trade-journal, eu-west-1, Free), created and filled through the Supabase connector. Structure only, no live data. Web migrations 0001–0085 at 774234d replayed in order, plus what live has beyond the migrations, captured with read-only catalog queries on live: tables subscriptions / notifications / disputes, 13 columns (trades.trade_thesis, trades.verification_tier, 9 profiles plan/leader columns, broker_accounts.flow_direction, account_scores.legacy_grace_period) and live's trades_enforce_locked_core_fields(). Compared against live table by table: columns, storage buckets and policies, triggers and the profiles_public view match; RLS policy differences are naming only. Details in bigmarkt-mobile `staging/README.md`.
- **Web repo finding (not changed):** the migrations can't rebuild live on their own. Missing from the repo: 3 tables and 13 columns (above). Live-only tables billing_events, leads, qa_items, signal_entries, signal_log (unused by web code at 774234d). 0055 fails on Postgres 17 (min(uuid)) and is marked superseded. 0012/0013 change function return types without dropping first. 0037 hits 42P07 on a fresh DB. 0051 starts with a byte-order mark. trades_enforce_locked_core_fields on live lacks the repo's `current_user = 'service_role'` check. A catch-up migration (owner-approved, on a branch) would let any new environment be built from the repo.
- **App → staging:** `npx expo start` loads `.env.development.local` (gitignored) and talks to staging with a visible STAGING badge; production builds keep `.env.local` (live). On staging the login screen hides the website signup/reset links (those create live accounts). Staging test users are created in the staging dashboard (Authentication → Add user), not by Claude.
- **Add trade + edit trade + chart upload built (staging only), 2026-09-14 (mobile aa89a89, 884c859).** One form in the approved layout mirrors web TradeForm / createTradeAction / updateTradeAction @ 774234d: same field limits, P&L auto-filled from pip-values once prices are touched, R:R from entry/exit/stop, EA and locked trades context-only, visibility, chart picked from the phone and shrunk to 1600px JPEG q0.82, magic-byte checked, stored at trade-charts/<user>/<trade>/chart-<time>.<ext> (replace deletes the old file, remove clears it). New trade creates the default "Personal" account like web getActiveAccount. Writes are compiled in only when the app points at staging (WRITES_ENABLED); live stays read-only. Not mirrored (service role, no endpoint yet): constitution violation recompute (owner-accepted v1 gap) and challenge streak update.
- **Tested on staging:** Android phone added XAUUSD BUY (+$200, R:R 4), edited it (thesis, notes, grade, session, Public), replaced and removed the chart (storage cleaned up). An EURUSD SELL with no stop loss was blocked on the phone with no request sent (P&L didn't auto-fill), most likely a number format from the phone keyboard; the form now accepts comma decimals / spaces / "+", explains why P&L didn't auto-fill, names the field when a save is blocked and logs blocked saves to the dev server. The same EURUSD trade then saved from the PC preview (−$20, LOSS, R:R empty); phone retest pending.
- **Phone retest passed:** a GBPUSD trade with no stop loss saved from Android (+$30, R:R empty).
- **Follow / pause / unfollow + reactions built (staging only), 2026-09-14.** Follow button on trader profiles, leaderboard, Discover and Following, mirroring web FollowButton / subscriptions actions (one-tap journal-only follow on the newest active account, upsert on broker_account_id+mode, soft-cancel unfollow); 🚀🎯🔥 via toggle_trade_reaction on feed cards and public trades. A brand-new user had no broker account ("Connect a broker account first"); the app now creates the default "Personal" account like web getActiveAccount. Not mirrored: new-follower / follower-left notifications (service role). Reaction verified on staging.
- **Staging test fixtures:** test1 made public (username test1, "Test One"); one verified EA GBPUSD trade for test1; second test user test2 created by the owner. The following feed only shows verified EA trades (manual trades never appear, same as web); the empty-feed message now says so.
- **Owner decisions 2026-09-14:** share trade card first; verified Cloud (metaapi) trades should appear in the following feed (applied to staging via bigmarkt-mobile staging/06-feed-include-cloud-trades.sql; the same change goes to the web repo as a migration on a branch and needs owner approval before live); shared images show % and R only, never dollar P&L; Cloud accounts are still connected on the website (no mobile MetaApi endpoint yet).
- **Share trade image built, 2026-09-14.** Compact Bybit/Binance-style card from trade detail (closed trades): pair, direction, result pill, a headline of the trade's saved return % (else its R:R), facts that exist (R:R, grade, session), entry → exit, SL/TP when set, up to 3 chips, source · date and profile link. No dollar P&L or lot size. Captured with react-native-view-shot, shared via expo-sharing; the web build uses a no-op capture so html2canvas stays out of the web bundle. Works on live too (no writes). First phone test found a broken "↑" glyph (rendered "ij") and a card that was too tall with empty boxes; both fixed. The owner confirmed the web pip table / risk calculator is correct, so the card no longer computes pips itself; its numbers come from the journal.
- **Return % for manual trades:** Add / Edit trade has an optional "Account balance at open" (pre-filled from the account's current, else starting balance); saving stores balance_at_open and return_pct = P&L ÷ balance × 100, the EA ingest formula. Web's manual form doesn't have the field; web shows the saved return_pct.
- **Analytics built, 2026-09-14.** Mirrors web analytics (lib/analytics.ts and lib/reportCard.ts copied verbatim): weekly / monthly report cards with Share report (image without dollar amounts; net P&L, best/worst trade and best/worst day stay on the private screen), equity curve and drawdown (react-native-svg), win rate by pair, session and setup grade, psychology (best/worst mindset, emotion table, insights).
- **Analytics moved into Journal as "Stats", 2026-09-15.** Home was getting crowded, so analytics now lives in Journal (List / Calendar / Stats). Owner decision: Stats covers only the account selected in Journal (web analytics covers all accounts minus "exclude"). Tapping a Home metric opens Journal Stats.
- **Flat design, 2026-09-15 (owner decision).** No faded green / red / gold fills anywhere in the app. Panels are solid with a thin border; colour appears only on text, icons, borders and a 3px left accent bar. Pills are outline-only, selected states get a gold border, and share images have no glow shapes.
- **Edit profile + photo built (staging only), 2026-09-15.** Me > Profile > Edit profile, mirroring web profile/actions.ts updateProfileAction and ProfileForm:
  - display name (1–40)
  - @username (3–30 letters / numbers / underscores, saved lower-case; a taken name shows an error)
  - visibility (private / community / public)
  - starting balance
  - auto-share verified trades
  - square photo, 512px JPEG, 2 MB cap, magic-byte check, uploaded to the private avatars bucket, old file removed

  Journal mode stays on the website, because web asks for the automation terms first. Phone-tested on staging (iPhone + Android):
  - photo upload and replace; the old file is deleted
  - duplicate username rejected
  - usernames saved lower-case
- **Other traders' photos are not shown in the app yet.** The avatars bucket only lets owners read their own folder; web signs other users' avatars server-side. This needs a small web endpoint (added to the website-approvals list).
- **Risk calculator built, 2026-09-15.** Me > Tools > Risk calculator, mirroring web calculator/page.tsx on the shared pip table:
  - same lot / pip value / SL distance / max loss math, 0.01 minimum lot
  - same warnings (risk above 5%, lot below minimum)
  - balance starts from the selected account's balance
  - comma decimals accepted
  - no writes, so it also works against live

  Checked in preview: EUR/USD 6% / 50 pips → 1.20 lot + HIGH RISK; 100000-pip SL → below-minimum warning. EUR/USD also phone-tested by the owner.
- **Gold pip size corrected in the app (owner, 2026-09-15).** 1 pip = $0.10 price move and $10 per pip per lot, so 4000 → 3990 is 100 pips and 0.10 lot risks $100. Mobile pip-values XAU/USD now uses pipFactor 10 / pipValue 10; web has 100 / 1.
  - Money is unchanged everywhere (auto P&L, constitution risk), because factor × value stays 100.
  - Only the calculator's SL distance and $/pip change.
  - **Web bug (not changed):** the live web calculator shows 1000 pips for the same trade. The fix is the same one-entry change in web lib/pip-values.ts, to go on a branch with owner approval.
- **Owner, 2026-09-15:** the two-phone follow / reactions / return % / Stats tests were done earlier; re-run them in the overall test pass before release.
- **Journal Add trade button, 2026-09-15.** The header "+" was hard to find, so it's now a floating gold "+ Add trade" button in List, Calendar and Stats (bottom of the list pane on tablets).
  - It shrinks to a round + after scrolling and expands back at the top.
  - The owner approved the smaller version.
  - Draggable was considered and not used: it moves by accident while scrolling.
- **Delete trade built (staging only), 2026-09-15.** Red outline button at the bottom of trade detail, mirroring web deleteTradeAction:
  - confirm first, with the web message plus "can't be undone"
  - delete the row with a user_id check on top of RLS, then remove the chart
  - rule deviations, reactions and events cascade
  - phones go back to Journal; the tablet pane updates its list

  Verified on staging with a throwaway trade.
- **Remember the chosen account, 2026-09-15.**
  - Staging: saved on profiles.active_broker_account_id, like web setActiveAccountAction (own-account check) and getActiveAccount (fallback saved back), so web and app agree.
  - Live: kept on the device per user, because the app doesn't write to the shared DB.
  - Verified in preview: switching to a second staging account ("Prop Test", a test1 fixture) and back survives a full reload, and the profile column updates.
- **Web findings (not changed):** web share card and report cards show dollar P&L on shareable images; following a second trader from the same account replaces the first follow (upsert on broker_account_id+mode); web EA-visibility toggle compares to "community".
- **Small fixes, 2026-09-15 (owner phone feedback):**
  - "Cancel" no longer wraps on iPhone with larger text: New / Edit trade and Edit profile top bars use flexible sides.
  - Delete trade is now a quiet grey text link, with the red kept in the confirm dialog.
- **Empty, loading, error and offline states, 2026-09-15.** Shared components (components/states.tsx):
  - Loading.
  - Error with Try again. It says "You're offline" when the phone has no connection and reloads by itself when the connection returns.
  - Empty with icon, title, text and an optional action.

  Applied to Home ("No trades yet" + Add trade), Journal list and Stats, Community feed / leaderboard / search, Me, Following, trader profile, trade detail, share, edit trade, edit profile and settings. An OFFLINE label shows next to STAGING (expo-network; also on live). Checked in the web preview by simulating offline: the label shows, Community shows the offline block, and the feed reloads on reconnect.
- **Quick visibility change on trade detail (staging only), 2026-09-15.**
  - The visibility tag is a small button that opens a sheet with Private / Public / Exclude (Followers when the trade already has it), in trade-form wording.
  - It saves immediately, like web setTradeVisibilityAction: visibility + trade_visibility, own trade only. Visibility isn't locked, so EA and Cloud trades can change it.
  - A failed save puts the old value back with a message.
  - Web defines setTradeVisibilityAction but no web UI uses it yet.
  - Verified on staging: Public → Private → Public on test1's XAUUSD trade.
- **WEB BUG (live, not changed): Settings "Show EA trades on public profile" never worked.**
  - setEaTradesVisibility writes visibility = 'community', which trades_visibility_check rejects (live and staging allow only private / public / exclude / followers_only; confirmed read-only on live), so turning it on always errors.
  - The page checks for 'community', so it always shows Off.
  - Turning it off sets every EA trade private, wiping per-trade Exclude / Followers choices.
  - **Owner decision 2026-09-15:** fixed behaviour. On makes Private EA trades Public, Off makes Public EA trades Private, and Exclude / Followers are left alone.
  - **Web fix prepared on branch `fix/ea-trades-visibility` (3802e21, from main 774234d)** in settings/page.tsx, EaVisibilityToggle.tsx and lib/actions/ea-visibility.ts. `npm run build` passes. Pushed to the branch only (Vercel preview); needs owner approval before merging to main.
- **Settings switch built in the app (staging only), 2026-09-15.** Same fixed behaviour.
  - Shows On when any EA trade is Public, says how many trades changed, and puts the switch back on failure.
  - Read-only (but correct) on live.
  - Verified on staging: Off → test1's EA GBPUSD private (both columns; EA lock allows it), On → public again.
- **Owner decisions 2026-09-19 (release):**
  - App ID `co.bigmarkt.journal` (permanent).
  - The released app saves on live too (same RLS as web). The known gap for app-created trades remains: no rule-check recompute, streaks or notifications until web endpoints exist.
  - App icon and splash use the full website wordmark.
- **Release prep done, 2026-09-19** (mobile repo docs/RELEASE.md):
  - Wordmark icon set and splash; the web favicon stays B + peak.
  - expo-updates with fingerprint runtime versions.
  - eas.json: preview = staging APK, production = live AAB; submit to the internal track as draft.
  - Expo packages aligned (expo-doctor 21/21).
  - Live columns checked identical to staging for every table the app writes (read-only catalog query).
  - Store assets in design/store.
- **Owner to do before the first build / listing:**
  - Create the EAS environment variables (commands in RELEASE.md).
  - Play developer account. New personal accounts need a 12-tester, 14-day closed test.
  - Service-account key for eas submit.
  - Play listing, data safety and content rating.
  - A reviewer test account on live.
  - **An account-deletion web page (Play requirement; needs web approval).**
- **Account deletion for Google Play, 2026-09-19 (owner request).** Settings → Delete account explains what gets deleted (the account is shared with journal.bigmarkt.co) and opens a pre-filled request email to support@bigmarkt.co with the account email and ID.
  - The Play Data safety web link is https://journal.bigmarkt.co/privacy, which says deletion is on request.
  - Deletions are a manual admin task until the web adds self-service deletion.
- **EAS set up, 2026-09-19 (owner approved).**
  - Environment variables were created on @bigmarkts-team/bigmarkt: preview = staging, production = live. Only publishable keys, plain text.
  - The first Android preview build (staging APK, versionCode 1) was started; its signing keystore was generated and is stored by EAS.
- **Android test builds (EAS preview, staging), 2026-09-19.**
  - First APK was universal, 115 MB; a test phone said "App not installed". Preview APKs now build only arm64-v8a + armeabi-v7a, about 65 MB, and install fine.
  - All preview builds had versionCode 1, so an update refused to install over the old one. Preview builds now auto-increment too (remote counter shared with production). Latest preview build: versionCode 3.
- **Splash / opening screen.**
  - Android 12+ clipped the wide wordmark splash image (the "t"), then showed it tiny inside the system splash circle.
  - Now the system splash is only the #0A0A0A background (blank image), and an in-app BrandSplash shows the full website wordmark at about 72% of screen width while the saved session loads (min 0.8s), then fades out.
- **Add broker account in the app, 2026-09-19 (owner request).** Me → Accounts → Add account, mirroring web AddAccountModal + createBrokerAccountAction + brokerAccountSchema:
  - label 1–50
  - broker from the supported / partial list
  - live / demo / prop firm
  - manual / automated (prop firm forced manual, as the DB prop_firm_must_be_manual check requires)
  - optional account number

  No investor password in the app (Cloud stays on the web). Mobile lib/brokers.ts is now a verbatim copy of web lib/brokers.ts @ 774234d. The insert was verified under RLS as a staging test user; live policy and checks were confirmed read-only to match.
- **Owner phone test pass so far (preview build, staging):**
  - Passed: trades add / edit / delete, Stats, charts, share cards, profile photo, Settings → Delete account (email pre-filled with account ID), offline label, sign-in.
  - Discover search showed nothing as test1: expected, because search excludes yourself and test2 is private.
  - Still to check: follow / pause / unfollow / reactions across phones, risk calculator, visibility + EA switches, Add account.
- **In-app signup and password reset, 2026-09-20.** Owner: bouncing to the browser mid-signup felt redundant. Mirrors web (auth)/actions.ts: name 1–80, valid email, new passwords 12+ chars, the already-has-an-account message, one generic reset answer. `auth-callback` screen reads Supabase email links (code or access_token, query or fragment) and sends recovery links to the new-password screen; it needs `bigmarkt://auth-callback` in Supabase redirect URLs. Web keeps Turnstile and the abuse-log reset limit; app resets rely on Supabase's own limits.
- **Auth email templates, 2026-09-22.** `docs/email-templates/` in the mobile repo. Gmail on iPhone recolours dark emails to light, and the site logo is white lettering on transparency, so it rendered invisible; the header now uses `/images/bigmarkt-logo-email.png` (dark panel baked in, merged to web main) plus bgcolor attributes and colour-scheme meta.
- **SUPPORT DESK SHIPPED 2026-09-22 (web main + live DB).**
  - Migration 0086 applied to staging and live by the owner: `support_agents` + `is_support_agent()`, RLS letting agents read and answer every conversation and set status, `support_people(uuid[])` returning only name / email / join date, `support_reply` added to the notifications type list, and a trigger that notifies the trader on every support reply.
  - `/support-desk` (PR #11) — inbox and thread view gated by `requireSupportAgent`, no admin nav. Promotion is one row: `insert into support_agents (user_id) values (...)`.
  - Verified on staging as an agent: sees conversations, replies, looks up the trader, sees 0 trades and only their own profile and account.
  - Also merged: PR #10 EA visibility fix (the Settings toggle had never worked), PR #12 email logo asset. Web main went 774234d → ae98ea4.
- **App support chat + notifications, 2026-09-22.** Me → App → Support mirrors web useSupportChat (open conversation or new, live replies, read flags via the RPC). Me → App → Notifications mirrors web notifications/page.tsx (unread gold bar, tap to mark read, mark all read); support replies deep-link to the chat, trade notifications to the trade. No further DB work.
- **Next options:**
  - Finish the test pass on the latest preview build (versionCode 9), including support chat and notifications.
  - Then the production build (live AAB) and eas submit to the Play internal track, once the owner has the Play developer account and service-account key.
  - Telegram alerts for new trader messages: needs `pg_net` enabled and a bot token in Supabase, then an edge function.
  - Website approvals still open:
    - Gold pip size fix (app fixed; web still shows 10× pips).
    - Cloud-in-feed migration.
    - Repo catch-up migration.
    - Avatar signing endpoint.
    - Server endpoints for violations / streaks / notifications.
    - Account deletion (the app now sends a support request email; web self-service still missing).
- Web privacy rules carry over unchanged: never show raw `pnl` on public/social surfaces (use return_pct / rr_ratio); the service-role key never ships in the app.

## Hard Rules
- PROP FIRM + CLOUD (clarified 2026-07-11): the "prop firm = journal-only" rule means copy EXECUTION is permanently disabled on prop accounts — it does NOT ban journaling. Automated READ-ONLY journaling via cloud/MetaApi (investor password + GET-only MetaStats) IS permitted for prop firms — provisionConnectionAction sets journal_mode='automated' for ALL cloud connections; is_prop_firm stays true, keeping the prop_firm badge + the deferred copy-execution lock in force. The EA/manual path still forces prop firms to manual (EAs can violate prop-firm rules; cloud read-only capture does not).
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
