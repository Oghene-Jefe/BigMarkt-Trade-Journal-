-- 0040_abuse_log.sql
-- Lightweight rate-limit + duplicate-suppression ledger for public forms
-- and the EA ingest endpoint. Service-role-only writes; no RLS policies
-- granted to authenticated/anon (the table stays invisible to clients).

create table if not exists public.abuse_log (
  id bigserial primary key,
  scope text not null,        -- 'fts_application' | 'club_application' | 'broker_submission' | 'ea_ingest'
  ip inet,                    -- nullable: requests through some proxies may not expose a usable IP
  email text,                 -- nullable: used by public forms; null for ea_ingest
  token_hash text,            -- nullable: used by ea_ingest for per-token throttling
  created_at timestamptz not null default now()
);

create index if not exists abuse_log_scope_ip_idx
  on public.abuse_log (scope, ip, created_at desc) where ip is not null;
create index if not exists abuse_log_scope_email_idx
  on public.abuse_log (scope, email, created_at desc) where email is not null;
create index if not exists abuse_log_scope_token_idx
  on public.abuse_log (scope, token_hash, created_at desc) where token_hash is not null;
create index if not exists abuse_log_created_idx
  on public.abuse_log (created_at desc);

alter table public.abuse_log enable row level security;
-- Intentionally no policies: only the service role (which bypasses RLS)
-- can read or write this table.

comment on table public.abuse_log is
  'Append-only ledger of public-form submissions and EA ingest hits, used '
  'for IP/email/token rate limiting and duplicate suppression. Pruned by '
  'the cleanup_abuse_log() function below; safe to truncate manually.';

-- Optional helper to prune old rows. Call from a cron, or ignore — the
-- table is small and the indexes are partial.
create or replace function public.cleanup_abuse_log(p_older_than interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.abuse_log where created_at < now() - p_older_than;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_abuse_log(interval) from public;
