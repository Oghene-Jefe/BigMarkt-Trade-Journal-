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
