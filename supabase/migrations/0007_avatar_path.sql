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
