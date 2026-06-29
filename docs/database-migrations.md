# Database migrations & drift

The production database had **drifted** from `supabase/migrations/` — objects
existed in prod that were never in the repo (`subscriptions`, `notifications`,
`get_referral_stats`, the chart-proxy RPC), and at least one committed migration
(`0032`) was never applied. Schema changes had been made directly in the
Supabase SQL editor instead of through committed migrations, so the repo was not
a faithful picture of prod and bugs hid in the gap.

## The rule for this project

**Every schema change is a committed migration file. Production application is
manual through the Supabase SQL Editor for this project; do not run
`supabase db push` against production.**

```bash
# 1. write supabase/migrations/00NN_description.sql
# 2. test it against local/staging data where possible
# 3. paste the migration into the Supabase SQL Editor for production
# 4. verify the changed table/RPC/policy exists in prod
# 5. commit the migration file
```

The important invariant is that production SQL and committed migrations stay in
lockstep. SQL Editor success messages are not enough for RPC changes; verify the
final function signature/body in `pg_proc` or by exercising the app path that
uses it.

## One-time: recover a true baseline (needs DB credentials)

Because prod has objects the migrations never created, a fresh apply of
`supabase/migrations/` cannot reproduce prod today. Capture the current prod
schema as a baseline (run locally — needs your Supabase login + DB password,
which CI/agents should not handle):

```bash
supabase login                                   # opens browser for an access token
supabase link --project-ref awvrylniqppybwaiwzse # DB password prompt
supabase db pull                                 # writes a baseline migration from prod
git add supabase/migrations && git commit -m "chore(db): baseline from prod"
```

After this, `supabase/migrations/` reproduces prod from scratch and the drift
check below becomes meaningful.

## CI drift check

`.github/workflows/schema-drift.yml` runs `supabase db diff --linked` on every
PR + daily and **fails if prod has drifted** from the committed migrations. It
no-ops until these repo secrets are set
(Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | personal token — supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF` | `awvrylniqppybwaiwzse` |
| `SUPABASE_DB_PASSWORD` | Project Settings → Database |

## Previously hand-applied migrations

These were applied directly to prod via the SQL editor during UAT fixes and are
committed to the repo (prod and repo are in sync for them). The baseline pull
above will subsume them:

| Migration | What |
|---|---|
| `0062_chart_proxy_access_fix.sql` | tighten chart-proxy RPC (demo + community-auth gates) |
| `0063_public_adherence_exclude_visibility.sql` | drop `exclude` trades from public adherence |
| `0064_fix_handle_new_user_referred_by.sql` | restore referral capture on signup + backfill |
| `0065_fix_get_referral_stats_ambiguous_refcode.sql` | fix ambiguous `ref_code` |
| `0066_follow_graph_rpcs.sql` | `get_follow_counts` / `get_follow_list` |

Current production main also includes later committed migrations through
`0081_search_profiles.sql`:

| Migration | What |
|---|---|
| `0067_idempotent_ingest.sql` | idempotent EA trade event ingest |
| `0070_following_feed.sql` | following feed RPC |
| `0071_auto_share_verified.sql` | auto-share verified-trade support |
| `0072_following_open_positions.sql` | live/open positions for followed leaders |
| `0073_get_public_score.sql` | public score RPC |
| `0074_trade_reactions.sql` | trade reactions table |
| `0075_toggle_trade_reaction.sql` | reaction read/toggle RPCs |
| `0076_feed_return_pct.sql` | feed returns `return_pct`, not raw `pnl` |
| `0077_public_trades_return_pct.sql` | public trades return `return_pct`, not raw `pnl` |
| `0079_public_trades_thesis.sql` | public trades expose `trade_thesis` |
| `0080_feed_enrichment.sql` | following feed exposes public trade-card detail |
| `0081_search_profiles.sql` | Discover profile search RPC |

> Note: `0032_referral_at_signup.sql` was in the repo but never applied to prod —
> `0064` re-asserts its effect. The baseline pull will reconcile any remaining
> objects that exist in prod but not in `supabase/migrations/`
> (`subscriptions`, `notifications` + policies, etc.).
