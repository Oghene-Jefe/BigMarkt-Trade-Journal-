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
