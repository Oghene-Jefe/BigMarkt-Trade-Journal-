-- =============================================================================
-- 0001_baseline_schema.sql
-- Baseline schema for BigMarkt. Matches the live prod schema column-for-column
-- so a fresh Supabase project receiving migrations 0001..0010 ends up with
-- the same tables this codebase has always assumed.
--
-- This file was rewritten in response to the codex review on f974174.
-- Original version invented column names that didn't match prod (the prod
-- tables predated this rebuild and were authoritative). The Slice 2 / Slice 6
-- code conformed to prod, but 0001 itself was left out of sync — which would
-- have produced a broken schema on any fresh staging project.
--
-- Idempotent: applying this against the existing prod DB is a no-op.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- =============================================================================
-- profiles
-- =============================================================================
create table if not exists public.profiles (
  id                 uuid primary key,
  email              text not null,
  name               text,
  source             text default 'signup',
  timezone           text default 'Africa/Lagos',
  experience         text,
  preferred_pairs    text,
  referred_by        text,
  ref_code           text,
  starting_balance   numeric,
  daily_loss_limit   numeric default 3,
  avatar_url         text,
  avatar_path        text,
  visibility         text default 'private',
  display_name       text,
  created_at         timestamptz default now(),
  updated_at         timestamptz not null default now()
);

alter table public.profiles
  add column if not exists source           text default 'signup',
  add column if not exists timezone         text default 'Africa/Lagos',
  add column if not exists experience       text,
  add column if not exists preferred_pairs  text,
  add column if not exists referred_by      text,
  add column if not exists ref_code         text,
  add column if not exists starting_balance numeric,
  add column if not exists daily_loss_limit numeric default 3,
  add column if not exists avatar_url       text,
  add column if not exists avatar_path      text,
  add column if not exists visibility       text default 'private',
  add column if not exists display_name     text,
  add column if not exists updated_at       timestamptz not null default now();

do $$ begin
  alter table public.profiles add constraint profiles_visibility_check
    check (visibility in ('private','community','public'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- =============================================================================
-- trades
-- =============================================================================
create table if not exists public.trades (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null,
  pair             text not null,
  direction        text not null,
  result           text not null,
  pnl              numeric default 0,
  rr_ratio         numeric,
  entry_price      numeric,
  exit_price       numeric,
  stop_loss        numeric,
  take_profit      numeric,
  lot_size         numeric,
  session          text,
  emotions         text,
  strategy         text,
  setup_grade      text,
  tags             text,
  notes            text,
  image_url        text,
  chart_path       text,
  trade_visibility text default 'public',
  visibility       text not null default 'private',
  created_at       timestamptz default now()
);

alter table public.trades
  add column if not exists rr_ratio         numeric,
  add column if not exists entry_price      numeric,
  add column if not exists exit_price       numeric,
  add column if not exists stop_loss        numeric,
  add column if not exists take_profit      numeric,
  add column if not exists lot_size         numeric,
  add column if not exists session          text,
  add column if not exists emotions         text,
  add column if not exists strategy         text,
  add column if not exists setup_grade      text,
  add column if not exists tags             text,
  add column if not exists notes            text,
  add column if not exists image_url        text,
  add column if not exists chart_path       text,
  add column if not exists trade_visibility text default 'public',
  add column if not exists visibility       text not null default 'private';

do $$ begin
  alter table public.trades add constraint trades_direction_check
    check (direction in ('BUY','SELL'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.trades add constraint trades_result_check
    check (result in ('WIN','LOSS','BE'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.trades add constraint trades_visibility_check
    check (visibility in ('private','public','exclude'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.trades add constraint trades_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists trades_user_id_idx on public.trades(user_id);
create index if not exists trades_created_at_idx on public.trades(created_at desc);

-- =============================================================================
-- balance_resets
-- =============================================================================
create table if not exists public.balance_resets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid,
  previous_balance numeric,
  new_balance      numeric,
  reason           text,
  reset_date       date,
  created_at       timestamptz default now()
);

alter table public.balance_resets
  add column if not exists previous_balance numeric,
  add column if not exists new_balance      numeric,
  add column if not exists reason           text,
  add column if not exists reset_date       date;

do $$ begin
  alter table public.balance_resets add constraint balance_resets_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists balance_resets_user_id_idx on public.balance_resets(user_id);

-- =============================================================================
-- challenges
-- =============================================================================
create table if not exists public.challenges (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid,
  start_date     date not null,
  end_date       date not null,
  goal_type      text not null,
  goal_target    numeric not null,
  status         text default 'active',
  current_streak integer default 0,
  longest_streak integer default 0,
  badge_earned   text,
  created_at     timestamptz default now(),
  completed_at   timestamptz
);

alter table public.challenges
  add column if not exists current_streak integer default 0,
  add column if not exists longest_streak integer default 0,
  add column if not exists badge_earned   text,
  add column if not exists completed_at   timestamptz;

do $$ begin
  alter table public.challenges add constraint challenges_status_check
    check (status in ('active','completed','failed','abandoned'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.challenges add constraint challenges_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists challenges_user_id_idx on public.challenges(user_id);

-- =============================================================================
-- admin_users
-- =============================================================================
create table if not exists public.admin_users (
  user_id     uuid primary key,
  granted_by  uuid,
  granted_at  timestamptz not null default now(),
  note        text
);

do $$ begin
  alter table public.admin_users add constraint admin_users_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.admin_users add constraint admin_users_granted_by_fkey
    foreign key (granted_by) references auth.users(id);
exception when duplicate_object then null; end $$;

-- =============================================================================
-- is_admin() helper
-- =============================================================================
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = uid);
$$;
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- =============================================================================
-- updated_at trigger on profiles
-- =============================================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- =============================================================================
-- profiles_public view — sanitized read surface for community/public reads
-- =============================================================================
drop view if exists public.profiles_public;
create view public.profiles_public
with (security_invoker = true) as
select
  id,
  coalesce(display_name, split_part(name, ' ', 1), 'Trader') as display_name,
  avatar_path,
  visibility,
  created_at
from public.profiles
where visibility in ('community','public');

comment on view public.profiles_public is
  'Email-stripped projection of profiles. RLS on the underlying table still applies.';
