# Database migrations & drift

The production database had **drifted** from `supabase/migrations/` — objects
existed in prod that were never in the repo (`subscriptions`, `notifications`,
`get_referral_stats`, the chart-proxy RPC), and at least one committed migration
(`0032`) was never applied. Schema changes had been made directly in the
Supabase SQL editor instead of through committed migrations, so the repo was not
a faithful picture of prod and bugs hid in the gap.

## The rule (going forward)

**Every schema change is a migration file, applied with the CLI. Never hand-edit
prod in the dashboard SQL editor.**

```bash
# 1. write supabase/migrations/00NN_description.sql
# 2. apply it to prod
supabase db push
# 3. commit the migration file
```

`supabase db push` applies only un-applied migrations and records them in the
remote `schema_migrations` table, so the repo and prod stay in lockstep.

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

## Migrations hand-applied this session

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
| `0067_idempotent_ingest.sql` | idempotent EA event logging and ingest backfill guards |
| `0070_following_feed.sql` | `get_following_feed` RPC for verified trades from followed leaders |
| `0071_auto_share_verified.sql` | `profiles.auto_share_verified` flag for new verified EA trade sharing |

> Note: `0032_referral_at_signup.sql` was in the repo but never applied to prod —
> `0064` re-asserts its effect. The baseline pull will reconcile any remaining
> objects that exist in prod but not in `supabase/migrations/`
> (`subscriptions`, `notifications` + policies, Pro plan columns, etc.).

## Current repo caveat

The app currently reads Pro plan fields from `profiles`
(`plan`, `plan_status`, `plan_renews_at`, `plan_source`, `pro_interest_at`), but
there is no numbered migration file for those columns in this checkout. Treat
that as schema-drift debt until a baseline pull or explicit migration captures
the production definition.
