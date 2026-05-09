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
