# Database migrations & drift

The production database had **drifted** from `supabase/migrations/` — objects
existed in prod that were never in the repo (`subscriptions`, `notifications`,
`get_referral_stats`, the chart-proxy RPC), and at least one committed migration
(`0032`) was never applied. Schema changes had been made directly in the
Supabase SQL editor instead of through committed migrations, so the repo was not
a faithful picture of prod and bugs hid in the gap.

## The current rule

**Every schema change needs a committed migration file, but production
migrations are applied manually in the Supabase SQL Editor. Do not run
`supabase db push` against production.**

This reflects the current operating rule in `CURRENT_STATE.md`: SQL Editor
reports are not enough, so verify persistence after apply, especially RPCs in
`pg_proc`.

Current flow:

1. Write `supabase/migrations/00NN_description.sql`.
2. Test on a staging/non-production project when possible.
3. Apply the exact SQL manually in the Supabase SQL Editor.
4. Verify the resulting tables, policies, grants, and RPC definitions.
5. Commit the migration file with the matching app change.

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

After this, `supabase/migrations/` can reproduce prod from scratch and the
drift check below becomes meaningful. This baseline command is for recovery
only; it is not the production apply path.

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

## Earlier manually applied reconciliation migrations

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

> Note: `0032_referral_at_signup.sql` was in the repo but never applied to prod —
> `0064` re-asserts its effect. The baseline pull will reconcile any remaining
> objects that exist in prod but not in `supabase/migrations/`
> (`subscriptions`, `notifications` + policies, etc.).

## Current migration head

The repo currently carries migrations through `0081_search_profiles.sql`
(with intentional numbering gaps after `0067`). Recent public-surface changes:

| Migration | What |
|---|---|
| `0079_public_trades_thesis.sql` | returns `trade_thesis` from public trades |
| `0080_feed_enrichment.sql` | widens the following feed with chart/thesis and trade anatomy, without dollar P&L |
| `0081_search_profiles.sql` | profile search RPC for Discover |
