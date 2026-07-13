-- 0085_metaapi_connection_metrics.sql
-- Account-level metrics snapshot per cloud connection, pulled from MetaStats
-- getMetrics during each sync. Powers the Balance / Growth% / Deposits display
-- for cloud accounts (the EA stamps per-trade balance; MetaStats gives account
-- aggregates directly). Nullable — populated on first sync. Idempotent.
-- Applied MANUALLY in the Supabase SQL Editor (never `supabase db push`).

alter table public.metaapi_connections
  add column if not exists balance             numeric,
  add column if not exists equity              numeric,
  add column if not exists deposits            numeric,
  add column if not exists profit              numeric,
  add column if not exists gain                numeric,
  add column if not exists metrics_updated_at  timestamptz;
