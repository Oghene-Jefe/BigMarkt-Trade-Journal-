# BigMarkt — Current State

_Last updated: 2026-07-01. Update this file at the end of every session._

## What BigMarkt Is
Verified trade-journaling and social-trading platform for SMC/ICT retail traders. Live app at journal.bigmarkt.co. Broker data captured via a read-only MQL5 EA over an HMAC-signed bridge. Copy-trading and $BMT token are deliberately out of current build scope.

## Live Surfaces
- journal.bigmarkt.co — the app
- bigmarkt.co — marketing + blog
- fts.bigmarkt.co — FTS academy
- club.bigmarkt.co — club

## Stack
Journal app: Next.js 15.5 / React 19 / TypeScript strict, Supabase Postgres (RLS), Tailwind, Vercel (auto-deploy on push to main). Marketing, FTS, and Club sites use Next.js 16.2 / React 19. App code in `web/`. Supabase project ref: awvrylniqppybwaiwzse (eu-west-1). Repo: Oghene-Jefe/BigMarkt-Trade-Journal-.

## Migration State
- Applied/expected in prod: 0001–0081, with intentional numbering gaps after 0067
- 0074 — trade_reactions table
- 0075 — reaction RPCs (get_trade_reactions, toggle_trade_reaction) — reconciled with prod
- 0076 — get_following_feed widened (return_pct, pnl removed)
- 0077 — get_public_trades widened (return_pct, pnl removed)
- 0079 — public trade thesis returned by get_public_trades
- 0080 — feed enrichment: entry/exit/SL/TP, lot_size, chart_path, session, setup_grade, trade_thesis
- 0081 — profile search RPC for Discover
- Migrations are applied MANUALLY in the Supabase SQL Editor — never `supabase db push`.

## Engagement Layer (C4) — Status
### C4a Reactions — SHIPPED
- trade_reactions table, RLS, three-reaction set: rocket / target / fire (🚀 🎯 🔥)
- Single reaction per user per trade (selecting a new one replaces the old; clicking your current one removes it)
- get_trade_reactions + toggle_trade_reaction: both SECURITY DEFINER with explicit visibility guards. Reader grants anon (counts visible on public trades); toggle requires auth.
- ReactionPicker.tsx — Telegram-style: collapsed by default, tap `+` to expand floating picker, animated. Replaces old ReactionBar.
- Cross-surface: feed, /@username, /p/[id] — one shared count, reacting from anywhere updates everywhere, persists on refresh.

### C4b Trade Thesis — PARTIALLY SHIPPED
- Public read path is live: `trade_thesis` is returned by `get_public_trades` and `get_following_feed`, and feed cards render it when present.
- Remaining work: improve the journal edit/create UX around thesis entry if product wants it promoted beyond the existing field.

### C4c Leader Content Layer — NOT STARTED
- Plan: closed-by-default content feed. Two tables — leader_posts (content) and content_access (gatekeeping with pending/approved/rejected). Both invite and request paths. Free now; payment later just becomes another way a row enters content_access (Phase D dependency).

## Privacy Model (SHIPPED this session)
- Raw dollar P&L (`pnl`) is NEVER returned to public surfaces — removed at the data layer in get_following_feed and get_public_trades.
- Public surfaces show `return_pct` PRIMARY, `rr_ratio` SECONDARY, fall back to WIN/LOSS.
- KEPT public: lot_size (broker-relative, plausible deniability, signals conviction), entry/exit, SL/TP, chart_path.
- Owner's PRIVATE dashboard/journal still shows real dollars. Admin surfaces keep pnl (fraud detection, >$10k flag).

## Feed (SHIPPED this session)
- /feed rebuilt: independent TradeCard components (not the old divided list).
- "Live now" section shows open positions (gold accent, pulsing dot) from get_following_open_positions, above closed "Recent" trades.
- TradeCard.tsx: trade-hero layout, pair in display font, return_pct/rr_ratio on the right, optional chart preview + thesis on closed enriched cards.
- /discover uses `search_profiles` to find public/community profiles by username or display name.

## Key Files
| What | Where |
|---|---|
| Reaction picker | web/components/ReactionPicker.tsx |
| Trade card (feed) | web/components/TradeCard.tsx |
| Feed page | web/app/(app)/feed/page.tsx |
| Feed data layer | web/lib/actions/feed.ts |
| Discover search | web/app/(app)/discover/page.tsx, web/lib/actions/search.ts |
| Public profile (@username) | web/app/(public)/[username]/page.tsx |
| Public profile (uuid) | web/app/p/[id]/page.tsx |
| Formatters | web/lib/format.ts (uses — for em-dash) |
| Scoring engine | web/lib/scoring.ts (ACTIVE_MIN_TRADES=30, ACTIVE_MIN_DAYS=30) |
| EA download | web/public/downloads/BigMarkt_EA_v2.7.1.ex5 |

## Trades Table — Relevant Columns
Full anatomy exists: entry_price, exit_price, close_price, stop_loss/sl, take_profit/tp, lot_size, pnl, rr_ratio, r_multiple, return_pct, balance_at_open, equity_at_open, account_currency, open_time, close_time, chart_path, return_pct, verification_tier, status, source, verified, trust_badge.
- return_pct: EA-populated (~10/22 trades currently). The privacy-safe % metric.
- r_multiple: column exists but EA does NOT populate it yet (0/22). Future EA task.
- rr_ratio: barely populated (~2/22), legacy field.
- equity_at_open / balance_at_open: per-trade account state (~11/22).

## Known / Deferred
- ~12 trades show blank magnitude (test data, null return_pct + null equity). Will self-populate as real EA trades flow in. Deliberately NOT backfilled.
- r_multiple unpopulated — EA should compute and write it (future EA task).
- "Livelier reactions" = custom animated assets (Lottie/SVG) — future, not Unicode emoji.
- Open-position feed cards intentionally omit dollar P&L and detailed trade anatomy; closed feed cards can show chart + thesis when shared.

## Build Queue (priority order)
1. C4b trade thesis UX polish, if needed
2. C4c leader content layer (biggest; pay-gating waits on Phase D)
3. B3 plan enforcement — deferred until MetaApi gives Pro a real feature
4. Phase D — Payments + MetaApi (D1 Paystack/Flutterwave, D2 MetaApi ingestion, D3 native Deriv/cTrader)
5. Admin-configurable scoring gates
6. More blog posts (crypto/stock/SMC/funded-trader keyword clusters)
7. Onboard founding leaders (non-code GTM step)

## Hard Rules
- `npm run build` is mandatory before every push (tsc --noEmit misses hydration + typed-route errors).
- Migrations applied manually in Supabase SQL Editor, never `supabase db push`.
- RPCs: SQL Editor reporting "success" does NOT guarantee persistence — verify in pg_proc.
- PostgREST chokes on a returns-column named `count` (use `cnt`) and on ambiguous column names in plpgsql (qualify or alias).
- SECURITY INVOKER functions can hit NULL auth.uid() at RLS check time — use SECURITY DEFINER with an explicit visibility guard for write paths that need the caller's identity.
- Never commit visa/audit docs (UK_EE_AUDIT.md is gitignored).
- No seed data in prod. Credentials never in code.

## Session Start Ritual
git fetch origin main && git switch main && git pull --ff-only origin main && git status
