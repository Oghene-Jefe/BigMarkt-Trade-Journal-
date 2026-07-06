# Database Migrations & Drift

Production schema changes for BigMarkt are represented by committed SQL files
in `supabase/migrations/`. The production database is updated manually through
the Supabase SQL Editor and then verified against the live schema.

## Current Rule

1. Write a new numbered migration file in `supabase/migrations/`.
2. Test it on a staging or disposable Supabase project when feasible.
3. Apply the exact SQL manually in the production Supabase SQL Editor.
4. Verify the object actually changed in production (`pg_proc`, `pg_policies`,
   table constraints, or targeted smoke queries as appropriate).
5. Commit the migration file with the code that depends on it.

Do not run `supabase db push` against production for this project. SQL Editor
"success" only means the statement executed; for RPCs and policies, verify the
resulting live object explicitly.

## Production State

`CURRENT_STATE.md` is the operational handoff for the live schema. As of the
current production baseline:

- Applied in production: `0001` through `0083`.
- `0078` is an unused gap and was never committed.
- Next migration number: `0084`.
- `0083` added `metaapi_connections`, `metaapi_sync_runs`, and widened
  `trades.capture_source` to include `metaapi`.

## Drift Checks

`.github/workflows/schema-drift.yml` runs `supabase db diff --linked` on PRs,
pushes to `main`, a daily schedule, and manual dispatch. It skips when the
required repository secrets are absent.

Required GitHub Actions secrets:

| Secret | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Personal token from `supabase.com/dashboard/account/tokens` |
| `SUPABASE_PROJECT_REF` | `awvrylniqppybwaiwzse` |
| `SUPABASE_DB_PASSWORD` | Production database password |

`.github/workflows/supabase-policy-guard.yml` separately checks that the unsafe
`support_messages.users_update_own_messages` policy has not reappeared. It uses
`SUPABASE_DB_URL` when configured and otherwise self-skips.

## Historical Context

Earlier in the rebuild, production drifted from `supabase/migrations/`: objects
existed in production that were not represented in the repo, and at least one
committed migration had not been applied. The repository now keeps additive
migrations in source control, but production application remains manual until
the operational process changes.

Historical hand-applied migrations that were reconciled in the repo include:

| Migration | What |
|---|---|
| `0062_chart_proxy_access_fix.sql` | Tighten chart-proxy RPC gates |
| `0063_public_adherence_exclude_visibility.sql` | Drop `exclude` trades from public adherence |
| `0064_fix_handle_new_user_referred_by.sql` | Restore referral capture and backfill |
| `0065_fix_get_referral_stats_ambiguous_refcode.sql` | Fix ambiguous `ref_code` |
| `0066_follow_graph_rpcs.sql` | Add follow count/list RPCs |
