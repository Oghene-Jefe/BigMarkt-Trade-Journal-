-- =============================================================================
-- 0012_exchange_schema.sql
-- Phase A of the Bybit auto-journaling feature.
--
-- Adds five tables for exchange connections, sync runs, raw imported data,
-- and the mapping that links imported closed-PnL records to BigMarkt
-- journal trades. All tables are user-owned, RLS-gated, anon-blocked.
--
-- Encryption of API credentials lives in app code (web/lib/exchanges/
-- crypto.ts) — this migration only declares ciphertext columns plus the
-- per-connection HKDF salt that pairs with them.
--
-- Idempotent.
-- =============================================================================

-- =============================================================================
-- exchange_connections — encrypted API credentials + safety metadata
-- =============================================================================
create table if not exists public.exchange_connections (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null,

  exchange              text not null,
  environment           text not null default 'mainnet',
  account_label         text,

  -- Ciphertext blobs are versioned JSON produced by lib/exchanges/crypto.ts.
  -- Salt is a per-connection random 32-byte value, base64-encoded as text
  -- so it travels cleanly through PostgREST/supabase-js without bytea
  -- encoding gymnastics. Same salt is used to derive the key for both
  -- the api_key and api_secret blobs.
  encrypted_api_key     text not null,
  encrypted_api_secret  text not null,
  key_salt              text not null,

  -- Last 4 + first 4 chars of the api key for UI display. Never the secret.
  api_key_hint          text,

  -- Bybit-side metadata captured at connect time via /v5/user/query-api.
  external_user_id      text,
  is_master             boolean,
  is_uta                boolean,
  permissions           jsonb not null default '{}'::jsonb,
  ip_bound              boolean not null default false,
  bound_ips             text[] not null default '{}',

  status                text not null default 'active',
  last_sync_at          timestamptz,
  last_error            text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.exchange_connections
  add column if not exists key_salt             text,
  add column if not exists external_user_id     text,
  add column if not exists is_master            boolean,
  add column if not exists is_uta               boolean,
  add column if not exists permissions          jsonb not null default '{}'::jsonb,
  add column if not exists ip_bound             boolean not null default false,
  add column if not exists bound_ips            text[] not null default '{}',
  add column if not exists last_sync_at         timestamptz,
  add column if not exists last_error           text;

do $$ begin
  alter table public.exchange_connections add constraint exchange_connections_exchange_check
    check (exchange in ('bybit'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_connections add constraint exchange_connections_environment_check
    check (environment in ('mainnet','testnet'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_connections add constraint exchange_connections_status_check
    check (status in ('active','paused','error','revoked'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_connections add constraint exchange_connections_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists exchange_connections_user_id_idx on public.exchange_connections(user_id);
create index if not exists exchange_connections_status_idx  on public.exchange_connections(status);

drop trigger if exists exchange_connections_set_updated_at on public.exchange_connections;
create trigger exchange_connections_set_updated_at
  before update on public.exchange_connections
  for each row execute function public.tg_set_updated_at();

-- =============================================================================
-- exchange_sync_runs — one row per sync attempt
-- =============================================================================
create table if not exists public.exchange_sync_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  connection_id   uuid not null,

  exchange        text not null,
  environment     text not null,
  category        text,

  status          text not null default 'running',
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,

  imported_count  integer not null default 0,
  skipped_count   integer not null default 0,
  error_message   text,

  window_start    timestamptz,
  window_end      timestamptz,
  cursor_before   text,
  cursor_after    text
);

do $$ begin
  alter table public.exchange_sync_runs add constraint exchange_sync_runs_status_check
    check (status in ('running','success','partial','failed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_sync_runs add constraint exchange_sync_runs_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_sync_runs add constraint exchange_sync_runs_connection_id_fkey
    foreign key (connection_id) references public.exchange_connections(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists exchange_sync_runs_connection_id_idx on public.exchange_sync_runs(connection_id);
create index if not exists exchange_sync_runs_user_started_idx  on public.exchange_sync_runs(user_id, started_at desc);

-- =============================================================================
-- exchange_closed_pnl — primary import source for journal-trade creation
-- =============================================================================
create table if not exists public.exchange_closed_pnl (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  connection_id     uuid not null,
  sync_run_id       uuid,

  exchange          text not null default 'bybit',
  environment       text not null,
  category          text not null,

  exchange_order_id text not null,
  symbol            text not null,
  side              text not null,
  qty               numeric,
  closed_size       numeric,
  avg_entry_price   numeric,
  avg_exit_price    numeric,
  closed_pnl        numeric,
  open_fee          numeric,
  close_fee         numeric,
  leverage          numeric,
  order_type        text,
  exec_type         text,

  opened_at         timestamptz,
  closed_at         timestamptz,                -- Bybit updatedTime

  raw_payload       jsonb not null default '{}'::jsonb,
  import_status     text not null default 'pending',

  created_at        timestamptz not null default now()
);

do $$ begin
  alter table public.exchange_closed_pnl add constraint exchange_closed_pnl_side_check
    check (side in ('Buy','Sell'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_closed_pnl add constraint exchange_closed_pnl_import_status_check
    check (import_status in ('pending','approved','ignored','imported','error'));
exception when duplicate_object then null; end $$;

-- Composite uniqueness — Bybit can return multiple closure events for the
-- same orderId (partial closes), so orderId alone collapses real data.
do $$ begin
  alter table public.exchange_closed_pnl add constraint exchange_closed_pnl_unique_closure
    unique (connection_id, exchange, category, exchange_order_id, closed_at, closed_size, closed_pnl);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_closed_pnl add constraint exchange_closed_pnl_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_closed_pnl add constraint exchange_closed_pnl_connection_id_fkey
    foreign key (connection_id) references public.exchange_connections(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_closed_pnl add constraint exchange_closed_pnl_sync_run_id_fkey
    foreign key (sync_run_id) references public.exchange_sync_runs(id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists exchange_closed_pnl_connection_id_idx on public.exchange_closed_pnl(connection_id);
create index if not exists exchange_closed_pnl_user_status_idx   on public.exchange_closed_pnl(user_id, import_status);
create index if not exists exchange_closed_pnl_closed_at_idx     on public.exchange_closed_pnl(closed_at desc);

-- =============================================================================
-- exchange_fills — execution-level audit trail
-- =============================================================================
create table if not exists public.exchange_fills (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  connection_id     uuid not null,
  sync_run_id       uuid,

  exchange          text not null default 'bybit',
  environment       text not null,
  category          text not null,

  exchange_order_id text,
  exchange_fill_id  text not null,        -- Bybit execId; unique per fill

  symbol            text not null,
  side              text not null,
  order_price       numeric,
  order_qty         numeric,
  exec_price        numeric,
  exec_qty          numeric,
  exec_value        numeric,
  exec_fee          numeric,
  fee_currency      text,
  fee_rate          numeric,
  exec_type         text,
  is_maker          boolean,
  seq               text,

  executed_at       timestamptz not null,

  raw_payload       jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now()
);

do $$ begin
  alter table public.exchange_fills add constraint exchange_fills_side_check
    check (side in ('Buy','Sell'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_fills add constraint exchange_fills_unique_fill
    unique (connection_id, exchange, category, exchange_fill_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_fills add constraint exchange_fills_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_fills add constraint exchange_fills_connection_id_fkey
    foreign key (connection_id) references public.exchange_connections(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_fills add constraint exchange_fills_sync_run_id_fkey
    foreign key (sync_run_id) references public.exchange_sync_runs(id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists exchange_fills_connection_id_idx on public.exchange_fills(connection_id);
create index if not exists exchange_fills_executed_at_idx   on public.exchange_fills(executed_at desc);
create index if not exists exchange_fills_order_id_idx      on public.exchange_fills(exchange_order_id);

-- =============================================================================
-- exchange_import_mappings — links imported closed PnL to BigMarkt journal trades
-- =============================================================================
create table if not exists public.exchange_import_mappings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,

  connection_id   uuid not null,
  closed_pnl_id   uuid,
  trade_id        uuid not null,

  created_at      timestamptz not null default now()
);

do $$ begin
  alter table public.exchange_import_mappings add constraint exchange_import_mappings_unique_closed_pnl
    unique (closed_pnl_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_import_mappings add constraint exchange_import_mappings_unique_trade
    unique (trade_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_import_mappings add constraint exchange_import_mappings_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_import_mappings add constraint exchange_import_mappings_connection_id_fkey
    foreign key (connection_id) references public.exchange_connections(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_import_mappings add constraint exchange_import_mappings_closed_pnl_id_fkey
    foreign key (closed_pnl_id) references public.exchange_closed_pnl(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exchange_import_mappings add constraint exchange_import_mappings_trade_id_fkey
    foreign key (trade_id) references public.trades(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- =============================================================================
-- RLS — strict self-only access on every table
-- =============================================================================
alter table public.exchange_connections      enable row level security;
alter table public.exchange_sync_runs        enable row level security;
alter table public.exchange_closed_pnl       enable row level security;
alter table public.exchange_fills            enable row level security;
alter table public.exchange_import_mappings  enable row level security;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'exchange_connections','exchange_sync_runs',
        'exchange_closed_pnl','exchange_fills',
        'exchange_import_mappings'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy exchange_connections_self_all
  on public.exchange_connections for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy exchange_sync_runs_self_all
  on public.exchange_sync_runs for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy exchange_closed_pnl_self_all
  on public.exchange_closed_pnl for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy exchange_fills_self_all
  on public.exchange_fills for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy exchange_import_mappings_self_all
  on public.exchange_import_mappings for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
