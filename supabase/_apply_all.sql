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
-- =============================================================================
-- 0002_rls_policies.sql
-- Strict RLS: anon reads NOTHING from base tables. All public/community reads
-- go through SECURITY DEFINER RPCs or sanitized views in 0003.
-- =============================================================================

alter table public.profiles        enable row level security;
alter table public.trades          enable row level security;
alter table public.balance_resets  enable row level security;
alter table public.challenges      enable row level security;
alter table public.admin_users     enable row level security;

-- Drop any prior policies (idempotent).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','trades','balance_resets','challenges','admin_users')
  loop
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------- profiles ---------------------------------------------------------
-- Owner can read/write their own row. NO anon access. NO cross-user reads.
-- Public/community discovery happens through profiles_public view + RPCs.
create policy "profiles_self_select"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_self_insert"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_self_update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No delete policy: deletion goes through admin RPC or auth.users cascade.

-- ---------- trades -----------------------------------------------------------
create policy "trades_self_select"
  on public.trades for select
  to authenticated
  using (user_id = auth.uid());

create policy "trades_self_insert"
  on public.trades for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "trades_self_update"
  on public.trades for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "trades_self_delete"
  on public.trades for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------- balance_resets ---------------------------------------------------
create policy "resets_self_select"
  on public.balance_resets for select
  to authenticated
  using (user_id = auth.uid());

create policy "resets_self_insert"
  on public.balance_resets for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------- challenges -------------------------------------------------------
create policy "challenges_self_all"
  on public.challenges for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- admin_users ------------------------------------------------------
-- Readable only via is_admin() SECURITY DEFINER. No direct SELECT for anyone.
-- (No policy = no access under RLS.)
-- =============================================================================
-- 0003_leaderboard_rpc.sql
-- Sanitized leaderboard. Returns aggregate stats + display name only.
-- NEVER returns email, raw trades, or rows for private profiles.
-- =============================================================================

drop function if exists public.get_leaderboard(text, integer);

create or replace function public.get_leaderboard(
  mode  text default 'quality',  -- 'quality' | 'earners'
  lim   integer default 20
)
returns table (
  user_id        uuid,
  display_name   text,
  avatar_url     text,
  trade_count    integer,
  win_rate       numeric,
  total_pnl      numeric,
  growth_pct     numeric,
  quality_score  numeric,
  badges         text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select p.id,
           coalesce(p.display_name, split_part(p.name,' ',1), 'Trader') as display_name,
           p.avatar_url,
           p.starting_balance
    from public.profiles p
    where p.visibility in ('community','public')
  ),
  agg as (
    select t.user_id,
           count(*)::int                                       as trade_count,
           count(*) filter (where t.result = 'WIN')::int       as wins,
           count(*) filter (where t.result = 'LOSS')::int      as losses,
           coalesce(sum(t.pnl), 0)                             as total_pnl,
           avg(t.rr_ratio) filter (where t.rr_ratio is not null) as avg_rr
    from public.trades t
    where t.visibility <> 'exclude'
    group by t.user_id
  ),
  scored as (
    select e.id as user_id,
           e.display_name,
           e.avatar_url,
           a.trade_count,
           case when (a.wins + a.losses) > 0
                then round((a.wins::numeric / (a.wins + a.losses)) * 100, 1)
                else 0 end                                     as win_rate,
           a.total_pnl,
           case when e.starting_balance is not null and e.starting_balance > 0
                then round((a.total_pnl / e.starting_balance) * 100, 2)
                else null end                                  as growth_pct,
           case when e.starting_balance is not null and e.starting_balance > 0
                 and a.trade_count >= 10
                then round(
                  (a.total_pnl / e.starting_balance) * 100
                  * (case when (a.wins + a.losses) > 0
                          then a.wins::numeric / (a.wins + a.losses)
                          else 0 end),
                2)
                else null end                                  as quality_score,
           array_remove(array[
             case when (a.wins + a.losses) > 0
                   and (a.wins::numeric / (a.wins + a.losses)) >= 0.6
                   and a.trade_count >= 20 then 'elite_wr' end,
             case when a.avg_rr >= 2.0 then 'sharp_rr' end
           ], null)                                            as badges
    from eligible e
    join agg a on a.user_id = e.id
  )
  select user_id, display_name, avatar_url, trade_count, win_rate,
         total_pnl, growth_pct, quality_score, badges
  from scored
  where (mode = 'quality' and quality_score is not null)
     or (mode = 'earners' and trade_count >= 5)
  order by
    case when mode = 'earners' then total_pnl end desc nulls last,
    case when mode = 'quality' then quality_score end desc nulls last
  limit greatest(1, least(lim, 100));
$$;

revoke all on function public.get_leaderboard(text, integer) from public;
grant execute on function public.get_leaderboard(text, integer) to authenticated, anon;
-- anon access is intentional: the function exposes only sanitized aggregates
-- for users who opted into community/public visibility.

comment on function public.get_leaderboard is
  'Sanitized leaderboard. Excludes private profiles, never returns email or raw trade rows.';

-- =============================================================================
-- Public profile RPC (for share pages). Returns only what visibility allows.
-- =============================================================================
drop function if exists public.get_public_profile(uuid);

create or replace function public.get_public_profile(profile_id uuid)
returns table (
  id            uuid,
  display_name  text,
  avatar_url    text,
  visibility    text,
  trade_count   integer,
  win_rate      numeric,
  growth_pct    numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select id, coalesce(display_name, split_part(name,' ',1), 'Trader') as display_name,
           avatar_url, visibility, starting_balance
    from public.profiles
    where id = profile_id
      and visibility in ('community','public')
  ),
  a as (
    select count(*)::int as trade_count,
           count(*) filter (where result = 'WIN')::int as wins,
           count(*) filter (where result = 'LOSS')::int as losses,
           coalesce(sum(pnl),0) as total_pnl
    from public.trades
    where user_id = profile_id and visibility <> 'exclude'
  )
  select p.id, p.display_name, p.avatar_url, p.visibility,
         a.trade_count,
         case when (a.wins + a.losses) > 0
              then round((a.wins::numeric/(a.wins+a.losses))*100, 1)
              else 0 end as win_rate,
         case when p.starting_balance is not null and p.starting_balance > 0
              then round((a.total_pnl / p.starting_balance) * 100, 2)
              else null end as growth_pct
  from p, a;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated, anon;

-- =============================================================================
-- Admin RPCs. All gated by is_admin(auth.uid()).
-- =============================================================================
drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id          uuid,
  email       text,
  name        text,
  source      text,
  created_at  timestamptz,
  trade_count integer,
  total_pnl   numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.name, p.source, p.created_at,
         coalesce((select count(*) from public.trades t where t.user_id = p.id), 0)::int,
         coalesce((select sum(pnl) from public.trades t where t.user_id = p.id), 0)
  from public.profiles p
  where public.is_admin(auth.uid())
  order by p.created_at desc;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

drop function if exists public.admin_delete_user(uuid);

create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- profiles cascade will remove trades/resets/challenges via FK on auth.users
  delete from public.profiles where id = target_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
-- =============================================================================
-- 0004_storage_policies.sql
-- Both buckets PRIVATE. Per-user CRUD scoped by path prefix (auth.uid()/...).
-- Public sharing of trade screenshots happens through signed URLs minted
-- server-side, never via storage.objects.getPublicUrl on a public bucket.
-- =============================================================================

-- Create buckets if missing, force them private.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('trade-charts', 'trade-charts', false)
on conflict (id) do update set public = false;

-- Drop prior policies on storage.objects scoped to our buckets (idempotent).
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'bm_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- Path convention: <auth.uid()>/<filename>. We enforce it via the policy.
create policy "bm_avatars_owner_rw"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "bm_charts_owner_rw"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'trade-charts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'trade-charts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No anon SELECT policy. To share a chart, the server mints a signed URL
-- with a short TTL after checking the trade's visibility. See
-- web/lib/storage.ts (signTradeChart).
-- =============================================================================
-- 0005_consolidate_visibility.sql
-- The existing prod schema had `trades.trade_visibility` (text, values:
-- 'public' | 'followers_only' | other). 0001 added a parallel `visibility`
-- column that 0002/0003 reference. Backfill `visibility` from the legacy
-- column so existing data isn't silently downgraded to 'private'.
--
-- Per REBUILD_BRIEF: 'followers_only' has no follower system to back it,
-- so it's treated as 'private' until that feature lands.
-- =============================================================================

update public.trades
set visibility = case
  when trade_visibility = 'public' then 'public'
  when trade_visibility = 'exclude' then 'exclude'
  else 'private'
end
where (trade_visibility is not null)
  and (visibility = 'private' or visibility is null);

-- We do NOT drop trade_visibility yet — the old static app at the repo root
-- still references it. Drop in a later migration after old app retirement.
-- =============================================================================
-- 0006_chart_path.sql
-- New `chart_path` column stores the storage object key (e.g.
-- "<user_id>/<trade_id>/chart-1234.jpg"). Display URLs are minted server-side
-- as signed URLs with short TTL — no permanent public links.
--
-- Legacy `image_url` is preserved (read-only) for the static app. Two shapes
-- exist there: (a) storage public URLs, (b) inline base64 data URLs from a
-- pre-storage era. Backfill handles (a). The base64 ones stay where they
-- are; the new app simply won't render them. A future cleanup can re-upload.
-- =============================================================================

alter table public.trades add column if not exists chart_path text;

update public.trades
set chart_path = regexp_replace(
  image_url,
  '^https?://[^/]+/storage/v1/object/public/trade-charts/',
  ''
)
where image_url is not null
  and image_url ~ '^https?://[^/]+/storage/v1/object/public/trade-charts/'
  and chart_path is null;

create index if not exists trades_chart_path_idx on public.trades(chart_path) where chart_path is not null;
-- =============================================================================
-- 0007_avatar_path.sql
-- Avatars get the same private-bucket + signed-URL treatment as trade charts.
-- New `profiles.avatar_path` stores the storage object key; legacy
-- `avatar_url` (public storage URLs from the static app era) is preserved
-- but unused by the new app.
--
-- Updates get_leaderboard + get_public_profile RPCs to return avatar_path
-- instead of avatar_url — clients sign the path with a short TTL.
-- =============================================================================

alter table public.profiles add column if not exists avatar_path text;

update public.profiles
set avatar_path = regexp_replace(
  avatar_url,
  '^https?://[^/]+/storage/v1/object/public/avatars/',
  ''
)
where avatar_url is not null
  and avatar_url ~ '^https?://[^/]+/storage/v1/object/public/avatars/'
  and avatar_path is null;

-- ---------- replace get_leaderboard to return avatar_path -------------------
drop function if exists public.get_leaderboard(text, integer);

create or replace function public.get_leaderboard(
  mode  text default 'quality',
  lim   integer default 20
)
returns table (
  user_id        uuid,
  display_name   text,
  avatar_path    text,
  trade_count    integer,
  win_rate       numeric,
  total_pnl      numeric,
  growth_pct     numeric,
  quality_score  numeric,
  badges         text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select p.id,
           coalesce(p.display_name, split_part(p.name,' ',1), 'Trader') as display_name,
           p.avatar_path,
           p.starting_balance
    from public.profiles p
    where p.visibility in ('community','public')
  ),
  agg as (
    select t.user_id,
           count(*)::int                                       as trade_count,
           count(*) filter (where t.result = 'WIN')::int       as wins,
           count(*) filter (where t.result = 'LOSS')::int      as losses,
           coalesce(sum(t.pnl), 0)                             as total_pnl,
           avg(t.rr_ratio) filter (where t.rr_ratio is not null) as avg_rr
    from public.trades t
    where t.visibility <> 'exclude'
    group by t.user_id
  ),
  scored as (
    select e.id as user_id,
           e.display_name,
           e.avatar_path,
           a.trade_count,
           case when (a.wins + a.losses) > 0
                then round((a.wins::numeric / (a.wins + a.losses)) * 100, 1)
                else 0 end                                     as win_rate,
           a.total_pnl,
           case when e.starting_balance is not null and e.starting_balance > 0
                then round((a.total_pnl / e.starting_balance) * 100, 2)
                else null end                                  as growth_pct,
           case when e.starting_balance is not null and e.starting_balance > 0
                 and a.trade_count >= 10
                then round(
                  (a.total_pnl / e.starting_balance) * 100
                  * (case when (a.wins + a.losses) > 0
                          then a.wins::numeric / (a.wins + a.losses)
                          else 0 end),
                2)
                else null end                                  as quality_score,
           array_remove(array[
             case when (a.wins + a.losses) > 0
                   and (a.wins::numeric / (a.wins + a.losses)) >= 0.6
                   and a.trade_count >= 20 then 'elite_wr' end,
             case when a.avg_rr >= 2.0 then 'sharp_rr' end
           ], null)                                            as badges
    from eligible e
    join agg a on a.user_id = e.id
  )
  select user_id, display_name, avatar_path, trade_count, win_rate,
         total_pnl, growth_pct, quality_score, badges
  from scored
  where (mode = 'quality' and quality_score is not null)
     or (mode = 'earners' and trade_count >= 5)
  order by
    case when mode = 'earners' then total_pnl end desc nulls last,
    case when mode = 'quality' then quality_score end desc nulls last
  limit greatest(1, least(lim, 100));
$$;

revoke all on function public.get_leaderboard(text, integer) from public;
grant execute on function public.get_leaderboard(text, integer) to authenticated, anon;

-- ---------- replace get_public_profile to return avatar_path ----------------
drop function if exists public.get_public_profile(uuid);

create or replace function public.get_public_profile(profile_id uuid)
returns table (
  id            uuid,
  display_name  text,
  avatar_path   text,
  visibility    text,
  trade_count   integer,
  win_rate      numeric,
  total_pnl     numeric,
  growth_pct    numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select id,
           coalesce(display_name, split_part(name,' ',1), 'Trader') as display_name,
           avatar_path, visibility, starting_balance
    from public.profiles
    where id = profile_id
      and visibility in ('community','public')
  ),
  a as (
    select count(*)::int as trade_count,
           count(*) filter (where result = 'WIN')::int as wins,
           count(*) filter (where result = 'LOSS')::int as losses,
           coalesce(sum(pnl),0) as total_pnl
    from public.trades
    where user_id = profile_id and visibility <> 'exclude'
  )
  select p.id, p.display_name, p.avatar_path, p.visibility,
         a.trade_count,
         case when (a.wins + a.losses) > 0
              then round((a.wins::numeric/(a.wins+a.losses))*100, 1)
              else 0 end as win_rate,
         a.total_pnl,
         case when p.starting_balance is not null and p.starting_balance > 0
              then round((a.total_pnl / p.starting_balance) * 100, 2)
              else null end as growth_pct
  from p, a;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated, anon;
-- =============================================================================
-- 0008_public_trades_rpc.sql
-- Returns the public trades for a given profile, used by the /p/[id] share
-- page. Filters apply at the database level so anon callers never see
-- private trades or rows from non-shareable profiles.
--
-- Returns chart_path (not the signed URL) — caller mints signed URLs
-- server-side at render time.
-- =============================================================================

drop function if exists public.get_public_trades(uuid, integer);

create or replace function public.get_public_trades(
  profile_id uuid,
  lim        integer default 50
)
returns table (
  id          uuid,
  pair        text,
  direction   text,
  result      text,
  pnl         numeric,
  rr_ratio    numeric,
  setup_grade text,
  tags        text,
  notes       text,
  chart_path  text,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  -- Hard requirement: profile must be community or public AND the trade
  -- itself must be public. Two layers of opt-in.
  select t.id, t.pair, t.direction, t.result, t.pnl, t.rr_ratio,
         t.setup_grade, t.tags, t.notes, t.chart_path, t.created_at
  from public.trades t
  join public.profiles p on p.id = t.user_id
  where t.user_id = profile_id
    and p.visibility in ('community','public')
    and t.visibility = 'public'
  order by t.created_at desc
  limit greatest(1, least(lim, 200));
$$;

revoke all on function public.get_public_trades(uuid, integer) from public;
grant execute on function public.get_public_trades(uuid, integer) to authenticated, anon;
-- =============================================================================
-- 0009_profile_on_signup.sql
-- Ensures every auth.users row has a corresponding public.profiles row.
-- The old static app handled this client-side after signup; the new app
-- pushes it to the database so neither the new server actions nor the old
-- JS-based signup flow can leave an account profile-less.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, source, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', null),
    'signup',
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any existing auth.users without a profiles row gets one now.
insert into public.profiles (id, email, source, created_at, updated_at)
select au.id, au.email, 'backfill', coalesce(au.created_at, now()), now()
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null;
-- =============================================================================
-- 0010_admin_rpcs.sql
-- Admin-only views into otherwise-private data. Every function checks
-- is_admin(auth.uid()) before returning anything; non-admin callers get
-- a permissions error from the RAISE, not silent empty rows (which would
-- otherwise be ambiguous with "no admins exist yet").
--
-- Replaces the old static app's admin.js pattern of `_sb.from('profiles')
-- .select('*')` from the browser, which only worked because RLS was
-- absent. With RLS on, those calls return [] and the panel breaks. These
-- RPCs are how admins legitimately reach across users.
-- =============================================================================

-- ---------- admin_overview ---------------------------------------------------
drop function if exists public.admin_overview();

create or replace function public.admin_overview()
returns table (
  total_users        integer,
  new_users_week     integer,
  new_users_month    integer,
  total_trades       integer,
  total_pnl          numeric,
  win_count          integer,
  loss_count         integer,
  win_rate           numeric,
  top_pair           text,
  top_pair_count     integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  with t as (
    select pair, result, pnl, created_at from public.trades
  ),
  pair_top as (
    select pair, count(*)::int as c
    from t where pair is not null
    group by pair
    order by c desc
    limit 1
  ),
  pair_safe as (
    select coalesce((select pair from pair_top), null) as pair,
           coalesce((select c from pair_top), 0) as c
  )
  select
    (select count(*)::int from public.profiles),
    (select count(*)::int from public.profiles where created_at >= now() - interval '7 days'),
    (select count(*)::int from public.profiles where created_at >= date_trunc('month', now())),
    (select count(*)::int from t),
    (select coalesce(sum(pnl),0) from t),
    (select count(*)::int from t where result = 'WIN'),
    (select count(*)::int from t where result = 'LOSS'),
    case when (select count(*) from t where result in ('WIN','LOSS')) > 0
         then round(
           (select count(*) filter (where result='WIN')::numeric from t)
           / (select count(*) filter (where result in ('WIN','LOSS')) from t) * 100, 1)
         else 0 end,
    (select pair from pair_safe),
    (select c from pair_safe);
end;
$$;

revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;

-- ---------- admin_recent_signups --------------------------------------------
drop function if exists public.admin_recent_signups(integer);

create or replace function public.admin_recent_signups(lim integer default 10)
returns table (
  id          uuid,
  email       text,
  name        text,
  source      text,
  visibility  text,
  created_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select p.id, p.email, p.name, p.source, p.visibility, p.created_at
  from public.profiles p
  order by p.created_at desc
  limit greatest(1, least(lim, 100));
end;
$$;

revoke all on function public.admin_recent_signups(integer) from public;
grant execute on function public.admin_recent_signups(integer) to authenticated;

-- ---------- admin_recent_trades ---------------------------------------------
drop function if exists public.admin_recent_trades(integer);

create or replace function public.admin_recent_trades(lim integer default 10)
returns table (
  id            uuid,
  user_id       uuid,
  user_email    text,
  user_name     text,
  pair          text,
  direction     text,
  result        text,
  pnl           numeric,
  created_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select t.id, t.user_id, p.email, p.name,
         t.pair, t.direction, t.result, t.pnl, t.created_at
  from public.trades t
  left join public.profiles p on p.id = t.user_id
  order by t.created_at desc
  limit greatest(1, least(lim, 100));
end;
$$;

revoke all on function public.admin_recent_trades(integer) from public;
grant execute on function public.admin_recent_trades(integer) to authenticated;

-- ---------- admin_top_pairs --------------------------------------------------
drop function if exists public.admin_top_pairs(integer);

create or replace function public.admin_top_pairs(lim integer default 7)
returns table (pair text, trade_count integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select t.pair, count(*)::int
  from public.trades t
  where t.pair is not null
  group by t.pair
  order by count(*) desc
  limit greatest(1, least(lim, 50));
end;
$$;

revoke all on function public.admin_top_pairs(integer) from public;
grant execute on function public.admin_top_pairs(integer) to authenticated;
-- =============================================================================
-- 0011_admin_purge_user_data.sql
-- Replaces admin_delete_user (which only deleted profiles, leaving the auth
-- user + all child data intact) with admin_purge_user_data: explicitly
-- removes everything in public.* belonging to the target user, but
-- intentionally leaves auth.users untouched.
--
-- Why not delete auth.users from this function: SECURITY DEFINER functions
-- run as the function owner (postgres in Supabase), but auth.users is
-- managed by the supabase_auth_admin role and writes from postgres are
-- discouraged. To fully delete the auth account, use the Supabase dashboard
-- or call auth.admin.deleteUser() from a service-role-keyed Edge Function.
--
-- For most "remove this user from the app" admin actions, purging the
-- public.* data is the right semantics — they can no longer log in
-- (well, they can, but they have no profile / trades / etc.) and a
-- platform admin can finalise the auth deletion via dashboard if needed.
-- =============================================================================

drop function if exists public.admin_delete_user(uuid);

create or replace function public.admin_purge_user_data(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Order matters only stylistically (FKs cascade either way) but we
  -- delete child rows first so partial failures leave consistent state.
  delete from public.trades         where user_id = target_id;
  delete from public.balance_resets where user_id = target_id;
  delete from public.challenges     where user_id = target_id;
  delete from public.profiles       where id = target_id;
  -- public.admin_users is not touched here — admins should not be able to
  -- demote each other accidentally via this entrypoint. Use a separate
  -- migration / SQL editor action to remove admin grants.
end;
$$;

revoke all on function public.admin_purge_user_data(uuid) from public;
grant execute on function public.admin_purge_user_data(uuid) to authenticated;

comment on function public.admin_purge_user_data is
  'Removes all public.* rows belonging to target_id. Leaves auth.users row intact.';
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
  -- Salt is a per-connection random 32-byte value; same salt is used to
  -- derive the key for both the api_key and api_secret blobs.
  encrypted_api_key     text  not null,
  encrypted_api_secret  text  not null,
  key_salt              bytea not null,

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
  add column if not exists key_salt             bytea,
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
