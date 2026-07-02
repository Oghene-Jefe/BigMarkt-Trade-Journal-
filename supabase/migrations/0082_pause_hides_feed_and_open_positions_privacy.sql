-- 0082_pause_hides_feed_and_open_positions_privacy.sql
-- 1) Pause should actually stop a leader's trades from appearing in a
--    follower's feed/open-positions strip — previously only 'cancelled'
--    was excluded, so 'paused' subscriptions still showed trades.
-- 2) get_following_open_positions still returned raw dollar pnl, missed by
--    the earlier privacy sweep (get_following_feed / get_public_trades
--    already swapped to return_pct). Fixed here to match.
drop function if exists public.get_following_feed(int, timestamptz);
create function public.get_following_feed(
  p_limit int default 50,
  p_before timestamptz default null
)
returns table (
  trade_id            uuid,
  user_id             uuid,
  pair                text,
  direction           text,
  result              text,
  entry_price         numeric,
  exit_price          numeric,
  stop_loss           numeric,
  take_profit         numeric,
  lot_size            numeric,
  return_pct          numeric,
  rr_ratio            numeric,
  session             text,
  setup_grade         text,
  trade_thesis        text,
  chart_path          text,
  trust_badge         text,
  source              text,
  status              text,
  created_at          timestamptz,
  leader_display_name text,
  leader_username     text,
  leader_avatar_path  text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id            as trade_id,
    t.user_id,
    t.pair,
    t.direction,
    t.result,
    t.entry_price,
    t.exit_price,
    t.stop_loss,
    t.take_profit,
    t.lot_size,
    t.return_pct,
    t.rr_ratio,
    t.session,
    t.setup_grade,
    t.trade_thesis,
    t.chart_path,
    t.trust_badge,
    t.source,
    t.status,
    t.created_at,
    p.display_name  as leader_display_name,
    p.username      as leader_username,
    p.avatar_path   as leader_avatar_path
  from public.trades t
  join public.profiles p on p.id = t.user_id
  where auth.uid() is not null
    and t.user_id in (
      select s.leader_id
      from public.subscriptions s
      where s.follower_id = auth.uid()
        and s.status = 'active'
    )
    and t.source = 'ea'
    and t.verified = true
    and t.trust_badge <> 'demo'
    and t.status = 'closed'
    and (t.visibility = 'public' or t.visibility = 'followers_only')
    and (p_before is null or t.created_at < p_before)
  order by t.created_at desc
  limit least(p_limit, 100);
$$;
revoke all on function public.get_following_feed(int, timestamptz) from public;
grant execute on function public.get_following_feed(int, timestamptz) to authenticated;

drop function if exists public.get_following_open_positions();
create function public.get_following_open_positions()
returns table (
  trade_id            uuid,
  user_id             uuid,
  pair                text,
  direction           text,
  return_pct          numeric,
  trust_badge         text,
  opened_at           timestamptz,
  leader_display_name text,
  leader_username     text,
  leader_avatar_path  text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    t.id            as trade_id,
    t.user_id,
    t.pair,
    t.direction,
    t.return_pct,
    t.trust_badge,
    t.created_at    as opened_at,
    p.display_name  as leader_display_name,
    p.username      as leader_username,
    p.avatar_path   as leader_avatar_path
  from trades t
  join profiles p on p.id = t.user_id
  where auth.uid() is not null
    and t.user_id in (
      select leader_id from subscriptions
      where follower_id = auth.uid()
        and status = 'active'
    )
    and t.source      = 'ea'
    and t.verified    = true
    and t.trust_badge <> 'demo'
    and t.status      = 'open'
    and t.visibility  in ('public', 'followers_only')
  order by t.created_at desc
  limit 20;
$$;
revoke all on function public.get_following_open_positions() from public;
grant execute on function public.get_following_open_positions() to authenticated;
