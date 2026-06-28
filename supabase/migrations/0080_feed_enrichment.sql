-- 0080_feed_enrichment.sql
-- Feed card enrichment: widen get_following_feed to return the same trade
-- detail the public profile RPC exposes — entry/exit/SL/TP, lot_size,
-- chart_path, session, setup_grade, trade_thesis. Same signature and guards
-- as 0076; only the column set grows. No dollar P&L (return_pct only).
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
        and s.status <> 'cancelled'
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
