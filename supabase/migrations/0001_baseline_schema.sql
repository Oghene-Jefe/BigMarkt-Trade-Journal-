-- =============================================================================
-- 0001_baseline_schema.sql
-- Brings the existing BigMarkt schema under version control and adds the
-- privacy split required by the rebuild brief. Idempotent: safe to re-run.
-- =============================================================================

-- ---------- profiles ---------------------------------------------------------
-- Existing columns (from current static app): id, email, name, avatar_url,
-- starting_balance, source, referred_by, timezone, experience, preferred_pairs,
-- daily_loss_limit, created_at.
--
-- We KEEP the table as the private source of truth, and expose a sanitized
-- view (profiles_public) for community/leaderboard reads. We add:
--   - display_name : what shows publicly (defaults to first word of name)
--   - visibility   : private | community | public
-- =============================================================================

create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  name               text,
  display_name       text,
  avatar_url         text,
  starting_balance   numeric,
  source             text,
  referred_by        text,
  timezone           text,
  experience         text,
  preferred_pairs    text[],
  daily_loss_limit   numeric,
  visibility         text not null default 'private'
                     check (visibility in ('private','community','public')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Backfill columns on pre-existing tables.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists visibility text not null default 'private';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.profiles
    add constraint profiles_visibility_check
    check (visibility in ('private','community','public'));
exception when duplicate_object then null; end $$;

-- ---------- trades -----------------------------------------------------------
create table if not exists public.trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  pair        text,
  direction   text check (direction in ('BUY','SELL')),
  result      text check (result in ('WIN','LOSS','BE')),
  pnl         numeric,
  rr_ratio    numeric,
  entry       numeric,
  exit        numeric,
  stop        numeric,
  size        numeric,
  session     text,
  emotions    text,
  grade       text,
  tags        text[],
  notes       text,
  image_url   text,
  visibility  text not null default 'private'
              check (visibility in ('private','public','exclude')),
  trade_at    timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.trades add column if not exists visibility text not null default 'private';

do $$ begin
  alter table public.trades
    add constraint trades_visibility_check
    check (visibility in ('private','public','exclude'));
exception when duplicate_object then null; end $$;

create index if not exists trades_user_id_idx on public.trades(user_id);
create index if not exists trades_created_at_idx on public.trades(created_at desc);

-- ---------- balance_resets ---------------------------------------------------
create table if not exists public.balance_resets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  old_balance  numeric,
  new_balance  numeric,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists balance_resets_user_id_idx on public.balance_resets(user_id);

-- ---------- challenges -------------------------------------------------------
create table if not exists public.challenges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text,
  starting      numeric,
  target        numeric,
  deadline      date,
  status        text default 'active' check (status in ('active','completed','failed','abandoned')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index if not exists challenges_user_id_idx on public.challenges(user_id);

-- ---------- admin_users ------------------------------------------------------
-- Server-side admin gate. Replaces client-side ADMIN_EMAILS array.
-- Insert rows manually via Supabase dashboard SQL editor; never via the API.
create table if not exists public.admin_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_by  uuid references auth.users(id),
  granted_at  timestamptz not null default now(),
  note        text
);

-- Helper used by every admin-gated RPC. SECURITY DEFINER so it can read
-- admin_users even when the caller's RLS would block them.
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

-- ---------- updated_at trigger on profiles -----------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ---------- profiles_public view --------------------------------------------
-- Sanitized read surface for community/public consumption. NEVER exposes email.
-- Respects visibility: private rows are simply absent from the view.
create or replace view public.profiles_public
with (security_invoker = true) as
select
  id,
  coalesce(display_name, split_part(name, ' ', 1), 'Trader') as display_name,
  avatar_url,
  visibility,
  created_at
from public.profiles
where visibility in ('community','public');

comment on view public.profiles_public is
  'Email-stripped projection of profiles. RLS on the underlying table still applies.';
