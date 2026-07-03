-- 0083_metaapi_connections_and_sync_runs.sql
-- MetaApi cloud-capture scaffolding (Pro/Max tier differentiator).
--
-- A MetaApi connection is a CAPTURE MECHANISM for a broker_accounts row —
-- the same relationship ea_tokens has today. Connecting via MetaApi links a
-- broker_accounts row; trades then carry broker_account_id exactly like EA
-- trades, so per-account scoring, the dashboard filter, prop-firm journal-only
-- locking, trust_badge derivation, and the open-snapshot reconcile all apply
-- unchanged. MetaApi trades write DIRECTLY to public.trades (EA model — no
-- staging/review), keyed on position_id/ticket like EA trades, with
-- source='metaapi' and capture_source='metaapi'.
--
-- CREDENTIAL MODEL: the broker investor (READ-ONLY) password is passed to
-- MetaApi at provision time and then DISCARDED — never stored here. We persist
-- only the MetaApi account id plus an encrypted READER-scoped MetaApi token.
-- Token encryption (app code, to be built at web/lib/metaapi/secrets.ts) mirrors
-- web/lib/ea/secrets.ts: AES-256-GCM + HKDF, master key METAAPI_TOKEN_ENCRYPTION_KEY,
-- HKDF info bound to (user_id, metaapi_account_id), empty salt — so no key_salt
-- column is needed. This migration only declares the columns.
--
-- Idempotent. Apply MANUALLY in the Supabase SQL Editor (never `supabase db push`).

-- =============================================================================
-- metaapi_connections — one per captured broker account
-- =============================================================================
create table if not exists public.metaapi_connections (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null,
  broker_account_id         uuid not null,

  -- MetaApi linkage. metaapi_account_id is the provisioned cloud account we poll.
  metaapi_account_id        text not null,
  region                    text,          -- MetaApi deployment region (e.g. 'new-york','london')

  -- Non-secret display/debug fields. NOT credentials.
  broker_server             text,          -- MT server name (e.g. 'ICMarketsSC-Live')
  login                     text,          -- MT account login (an identifier, not a secret)

  -- Encrypted READER-scoped MetaApi token (single secret). Base64 blobs written
  -- by web/lib/metaapi/secrets.ts. The broker password is NEVER stored.
  reader_token_ciphertext   text,
  reader_token_iv           text,
  reader_token_tag          text,
  reader_token_key_version  integer,

  status                    text not null default 'provisioning',
  last_sync_at              timestamptz,
  last_error                text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Backfill-safe column adds (in case an earlier partial run created the table).
alter table public.metaapi_connections
  add column if not exists region                   text,
  add column if not exists broker_server            text,
  add column if not exists login                    text,
  add column if not exists reader_token_ciphertext  text,
  add column if not exists reader_token_iv          text,
  add column if not exists reader_token_tag         text,
  add column if not exists reader_token_key_version integer,
  add column if not exists last_sync_at             timestamptz,
  add column if not exists last_error               text;

-- One MetaApi connection per broker account.
do $$ begin
  alter table public.metaapi_connections add constraint metaapi_connections_broker_account_unique
    unique (broker_account_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.metaapi_connections add constraint metaapi_connections_status_check
    check (status in ('provisioning','active','paused','error','revoked'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.metaapi_connections add constraint metaapi_connections_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.metaapi_connections add constraint metaapi_connections_broker_account_id_fkey
    foreign key (broker_account_id) references public.broker_accounts(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists metaapi_connections_user_id_idx on public.metaapi_connections(user_id);
create index if not exists metaapi_connections_status_idx  on public.metaapi_connections(status);

drop trigger if exists metaapi_connections_set_updated_at on public.metaapi_connections;
create trigger metaapi_connections_set_updated_at
  before update on public.metaapi_connections
  for each row execute function public.tg_set_updated_at();

-- =============================================================================
-- metaapi_sync_runs — one row per poll attempt (Vercel cron)
-- =============================================================================
create table if not exists public.metaapi_sync_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  connection_id   uuid not null,

  status          text not null default 'running',
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,

  imported_count  integer not null default 0,   -- trades upserted (new + updated)
  skipped_count   integer not null default 0,   -- unchanged rows

  window_start    timestamptz,                  -- MetaStats query window polled
  window_end      timestamptz,

  error_message   text
);

do $$ begin
  alter table public.metaapi_sync_runs add constraint metaapi_sync_runs_status_check
    check (status in ('running','success','partial','failed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.metaapi_sync_runs add constraint metaapi_sync_runs_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.metaapi_sync_runs add constraint metaapi_sync_runs_connection_id_fkey
    foreign key (connection_id) references public.metaapi_connections(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists metaapi_sync_runs_connection_id_idx on public.metaapi_sync_runs(connection_id);
create index if not exists metaapi_sync_runs_user_started_idx  on public.metaapi_sync_runs(user_id, started_at desc);

-- =============================================================================
-- Widen trades.capture_source to accept 'metaapi'
-- Current CHECK (from 0012) allows ('manual','ea','websocket'). Insert of a
-- MetaApi row would fail without this. Drop ANY existing check that references
-- capture_source (name-agnostic) then re-add the widened one.
-- NOTE: types.ts lists a 'signal' capture_source the DB never had — deliberately
-- NOT added here (unused; add if/when a signal write path actually exists).
-- =============================================================================
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'trades'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%capture_source%'
  loop
    execute format('alter table public.trades drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.trades
  add constraint trades_capture_source_check
    check (capture_source in ('manual','ea','websocket','metaapi'));

-- =============================================================================
-- RLS — strict self-only, mirroring the exchange_* tables
-- =============================================================================
alter table public.metaapi_connections enable row level security;
alter table public.metaapi_sync_runs   enable row level security;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('metaapi_connections','metaapi_sync_runs')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy metaapi_connections_self_all
  on public.metaapi_connections for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy metaapi_sync_runs_self_all
  on public.metaapi_sync_runs for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
