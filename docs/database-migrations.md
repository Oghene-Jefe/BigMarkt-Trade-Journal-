# Database migrations & drift

The production database had **drifted** from `supabase/migrations/` — objects
existed in prod that were never in the repo (`subscriptions`, `notifications`,
`get_referral_stats`, the chart-proxy RPC), and at least one committed migration
(`0032`) was never applied. Schema changes had been made directly in the
Supabase SQL editor instead of through committed migrations, so the repo was not
a faithful picture of prod and bugs hid in the gap.

## The rule

**Every schema change is a migration file, applied with the CLI. Do not make
untracked production changes in the dashboard SQL editor.**

```bash
# 1. write supabase/migrations/00NN_description.sql
# 2. test it against staging, then apply it to prod
supabase db push
# 3. commit the migration file
```

`supabase db push` applies only un-applied migrations and records them in the
remote `schema_migrations` table, so the repo and prod stay in lockstep.

## Baseline / drift recovery (needs DB credentials)

The repository now tracks migrations through `0082`. If CI reports drift, first
confirm whether production has objects that were changed directly outside the
repo. To recover, capture the current prod schema locally (needs your Supabase
login + DB password, which CI/agents should not handle):

```bash
supabase login                                   # opens browser for an access token
supabase link --project-ref awvrylniqppybwaiwzse # DB password prompt
supabase db pull                                 # writes a baseline migration from prod
git add supabase/migrations && git commit -m "chore(db): baseline from prod"
```

After this, commit the generated migration so `supabase/migrations/` can
reproduce prod from scratch and the drift check stays meaningful.

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

## Historical hand-applied migrations

These were applied directly to prod via the SQL editor during UAT fixes and
then committed to the repo. Keep this list for provenance only; new work should
use committed migrations plus CLI apply.

| Migration | What |
|---|---|
| `0062_chart_proxy_access_fix.sql` | tighten chart-proxy RPC (demo + community-auth gates) |
| `0063_public_adherence_exclude_visibility.sql` | drop `exclude` trades from public adherence |
| `0064_fix_handle_new_user_referred_by.sql` | restore referral capture on signup + backfill |
| `0065_fix_get_referral_stats_ambiguous_refcode.sql` | fix ambiguous `ref_code` |
| `0066_follow_graph_rpcs.sql` | `get_follow_counts` / `get_follow_list` |

> Note: `0032_referral_at_signup.sql` was in the repo but never applied to prod —
> `0064` re-asserts its effect. The baseline pull will reconcile any remaining
> objects that exist in prod but not in `supabase/migrations/`
> (`subscriptions`, `notifications` + policies, etc.).

## Current tracked tail

The latest production implementation represented in the repo includes:

| Migration | What |
|---|---|
| `0074_trade_reactions.sql` | trade reaction rows |
| `0075_toggle_trade_reaction.sql` | reaction read/toggle RPCs |
| `0076_feed_return_pct.sql` | following feed returns `return_pct`, not raw `pnl` |
| `0077_public_trades_return_pct.sql` | public trades return `return_pct`, not raw `pnl` |
| `0079_public_trades_thesis.sql` | public trades include `trade_thesis` |
| `0080_feed_enrichment.sql` | following feed includes chart/thesis/trade-detail fields |
| `0081_search_profiles.sql` | community/public profile search RPC |
| `0082_pause_hides_feed_and_open_positions_privacy.sql` | paused follows hidden; open positions return `return_pct` |
