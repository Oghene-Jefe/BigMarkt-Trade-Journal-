-- 0070_following_feed.sql
--
-- C2 step (i): the "following feed". A signed-in user's feed of verified
-- trades from every leader they follow. This is the first place the
-- 'followers_only' trade visibility actually does anything — every leader
-- in the caller's follow set is, by construction, followed by the caller,
-- so a leader's followers_only trades are legitimately visible here (and
-- nowhere else yet).
--
-- A "follow" mirrors 0066: a row in subscriptions where follower_id =
-- caller and status <> 'cancelled' (active or paused both count).
--
-- A "verified" trade mirrors get_public_trades (0046): source from the EA,
-- closed, verified, and never a demo trust badge.
--
-- SECURITY DEFINER + fixed search_path + revoke-from-public + grant-to-
-- authenticated, exactly like 0066. anon is intentionally NOT granted —
-- the feed is meaningless without a caller identity (auth.uid()).
--
-- Idempotent. Safe to re-run against prod.

create or replace function public.get_following_feed(
  p_limit int default 50,
  p_before timestamptz default null
)
returns table (
  trade_id            uuid,
  user_id             uuid,
  pair                text,
  direction           text,
  result              text,
  pnl                 numeric,
  rr_ratio            numeric,
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
    t.pnl,
    t.rr_ratio,
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
    and (
      t.visibility = 'public'
      -- caller follows every leader in the set above, so a leader's
      -- followers_only trades are visible to them here.
      or t.visibility = 'followers_only'
    )
    and (p_before is null or t.created_at < p_before)
  order by t.created_at desc
  limit least(p_limit, 100);
$$;

revoke all on function public.get_following_feed(int, timestamptz) from public;
grant execute on function public.get_following_feed(int, timestamptz) to authenticated;
