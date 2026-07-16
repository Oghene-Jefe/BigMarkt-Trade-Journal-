# Database migrations and production verification

Supabase schema changes are tracked as ordered SQL files in `supabase/migrations/`. Historical production drift means the repository's migration ledger is documentation and review history, not a safe unattended production deployment mechanism.

## Production rule

Do not run `supabase db push` against production.

For every production schema change:

1. Add an additive, idempotent migration named `00NN_description.sql`.
2. Review the SQL, especially RLS policies, grants, `SECURITY DEFINER` functions, and destructive statements.
3. Test it on a disposable or staging project when practical.
4. Apply the reviewed SQL manually in the production Supabase SQL Editor.
5. Verify the resulting tables, columns, constraints, policies, functions, grants, and function signatures with explicit catalog queries.
6. Commit the same SQL file so the repository records what was applied.

The SQL Editor reporting success is not sufficient evidence that an overloaded function, policy, or constraint has the intended final shape. Query `pg_proc`, `pg_policies`, `information_schema`, or `pg_catalog` as appropriate.

## Current migration range

Production is documented through migration `0085`; `0078` is an unused numbering gap. See `CURRENT_STATE.md` for the purpose and live verification status of the latest migrations.

## Drift checks

`.github/workflows/schema-drift.yml` compares the linked production schema with the committed migration state when its Supabase secrets are configured. `.github/workflows/supabase-policy-guard.yml` separately asserts that a known-dangerous support-message update policy remains absent.

These checks are detection and verification aids. They do not authorize CI or contributors to mutate production.

Required repository secrets for the schema drift workflow are:

| Secret | Purpose |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Authenticate the Supabase CLI |
| `SUPABASE_PROJECT_REF` | Select the production project |
| `SUPABASE_DB_PASSWORD` | Compare against the linked database |

If these secrets are absent, the workflow reports a warning and skips rather than producing false assurance.
