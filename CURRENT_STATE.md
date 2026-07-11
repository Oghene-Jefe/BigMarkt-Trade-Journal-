# BigMarkt — Current State

_Last updated: 2026-07-11. Update this file at the end of every session._

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
- 0083 — MetaApi scaffolding: metaapi_connections + metaapi_sync_runs tables (both RLS self-only, FKs cascade to auth.users + broker_accounts + metaapi_connections), and trades.capture_source CHECK widened to include 'metaapi'. Verified in prod: single capture_source check constraint present, all 4 FKs cascade-correct. No new migration (0084) needed — live probe confirmed positionId present on closed trades, so MetaApi trades key on position_id exactly like the EA; no external_id column required.
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
- web/vercel.json: added metaapi-sync cron (*/15 * * * *). Four crons total.

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

### PRE-LAUNCH GATES (added 2026-07-11)
- Swap the TEMPORARY isAdmin() gate in metaapi-actions.ts for a real Pro-entitlement check when Phase D payments ship (currently admin-only = solo testing).
- Rate limit SHIPPED (10 provisions/hr/IP via abuse_log scope 'metaapi_provision'). Consider adding a per-user cap before broad launch.
- (Still stands) Vercel Hobby→Pro + restore metaapi-sync cron to */15 (see PRE-LAUNCH REMINDER above).

### Housekeeping deferred
- Revoke probe tokens in MetaApi API Access (read-only, low risk, but revoke).
- Delete stale clone C:\Users\User\bigmarkt-trade-journal (do via File Explorer, verify by eye — the stale one has NO web/lib/metaapi folder).
- Keep test account UNDEPLOYED between sessions to preserve $5 credit.

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
