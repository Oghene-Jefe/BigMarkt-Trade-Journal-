-- 0042_ea_request_nonces.sql
-- Replay-protection nonce ledger for EA ingest v2.
-- See docs/ea-replay-protocol.md §4 for the validation flow.
--
-- A request is rejected as a replay iff the (token_hash, nonce) pair is
-- already present. We rely on the PRIMARY KEY uniqueness constraint as
-- the atomic check — INSERT either succeeds (fresh nonce) or fails with
-- a 23505 unique_violation (replay → 409 Conflict).
--
-- TTL: 10 minutes. The timestamp window for sent_at is ±5 min, so any
-- nonce older than ~10 min from now can no longer be a valid replay.
-- The table stays small; pruning is opportunistic (see
-- cleanup_ea_request_nonces() below) and not on the request critical path.

create table if not exists public.ea_request_nonces (
  token_hash text not null,
  nonce      text not null,
  sent_at    timestamptz not null,
  seen_at    timestamptz not null default now(),
  primary key (token_hash, nonce)
);

-- Supports cleanup_ea_request_nonces() and bounds growth in case the
-- cleanup function isn't wired into cron.
create index if not exists ea_request_nonces_seen_at_idx
  on public.ea_request_nonces (seen_at);

alter table public.ea_request_nonces enable row level security;
-- No policies: service-role only, like abuse_log.

comment on table public.ea_request_nonces is
  'Per-request nonce ledger for EA ingest v2 replay protection. '
  'Atomic INSERT into PRIMARY KEY (token_hash, nonce) is the replay '
  'check; duplicate → unique_violation → 409. Prune older than ~10 min '
  'via cleanup_ea_request_nonces().';

create or replace function public.cleanup_ea_request_nonces(
  p_older_than interval default interval '10 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare deleted_count integer;
begin
  delete from public.ea_request_nonces where seen_at < now() - p_older_than;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_ea_request_nonces(interval) from public;
