# Database migrations & drift

The production database had **drifted** from `supabase/migrations/` — objects
existed in prod that were never in the repo (`subscriptions`, `notifications`,
`get_referral_stats`, the chart-proxy RPC), and at least one committed migration
(`0032`) was never applied. Schema changes had been made directly in the
Supabase SQL editor instead of through committed migrations, so the repo was not
a faithful picture of prod and bugs hid in the gap.

## Current production rule

**Every schema change must have a numbered migration file. Production changes
are reviewed and applied manually in the Supabase SQL Editor. Do not run
`supabase db push` against production.**

```bash
# 1. write supabase/migrations/00NN_description.sql
# 2. review and commit the exact SQL
# 3. apply that file manually in the production SQL Editor
# 4. record and verify the applied migration in CURRENT_STATE.md
```

This manual process is an operational constraint, not proof that a migration
ran. Verify affected tables, functions, grants, policies, or constraints after
application. Migration filenames contain historical gaps and duplicate numeric
prefixes, so always identify a change by its full filename.

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

## Proposed CI drift check (not implemented)

A future `.github/workflows/schema-drift.yml` could run `supabase db diff
--linked` on pull requests and on a schedule. No such workflow exists in this
repository today. It would require these GitHub Actions secrets:

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

> Note: `0032_referral_at_signup.sql` was in the repo but never applied to prod —
> `0064` re-asserts its effect. The baseline pull will reconcile any remaining
> objects that exist in prod but not in `supabase/migrations/`
> (`subscriptions`, `notifications` + policies, etc.).
