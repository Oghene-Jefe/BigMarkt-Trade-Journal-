-- Returns open EA positions from traders the caller follows.
-- Used by the dashboard LiveFollowingStrip (30 s poll).
CREATE OR REPLACE FUNCTION public.get_following_open_positions()
RETURNS TABLE (
  trade_id            uuid,
  user_id             uuid,
  pair                text,
  direction           text,
  pnl                 numeric,
  trust_badge         text,
  opened_at           timestamptz,
  leader_display_name text,
  leader_username     text,
  leader_avatar_path  text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    t.id            AS trade_id,
    t.user_id,
    t.pair,
    t.direction,
    t.pnl,
    t.trust_badge,
    t.created_at    AS opened_at,
    p.display_name  AS leader_display_name,
    p.username      AS leader_username,
    p.avatar_path   AS leader_avatar_path
  FROM   trades t
  JOIN   profiles p ON p.id = t.user_id
  WHERE  auth.uid() IS NOT NULL
    AND  t.user_id IN (
           SELECT leader_id FROM subscriptions
           WHERE  follower_id = auth.uid()
             AND  status <> 'cancelled'
         )
    AND  t.source      = 'ea'
    AND  t.verified    = true
    AND  t.trust_badge <> 'demo'
    AND  t.status      = 'open'
    AND  t.visibility  IN ('public', 'followers_only')
  ORDER BY t.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.get_following_open_positions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_following_open_positions() TO authenticated;
