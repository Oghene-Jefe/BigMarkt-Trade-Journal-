-- 0029_demo_trust_badge.sql
-- Adds 'demo' as a valid trust_badge value for EA trades from demo broker accounts.
-- Demo trades are private: excluded from public profiles and the leaderboard.

-- 1. Extend the trust_badge CHECK constraint to include 'demo'
ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_trust_badge_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_trust_badge_check
    CHECK (trust_badge IN ('manual', 'auto_verified', 'draft', 'edited', 'prop_firm', 'demo'));

-- 2. Update get_public_trades to exclude demo trades.
--    Demo trades are private to the owning trader — never shown on public profiles.
CREATE OR REPLACE FUNCTION public.get_public_trades(profile_id uuid, lim int DEFAULT 20)
RETURNS TABLE (
  id                  uuid,
  pair                text,
  direction           text,
  result              text,
  entry_price         numeric,
  exit_price          numeric,
  stop_loss           numeric,
  take_profit         numeric,
  lot_size            numeric,
  pnl                 numeric,
  rr_ratio            numeric,
  session             text,
  emotions            text,
  strategy            text,
  setup_grade         text,
  tags                text,
  notes               text,
  chart_path          text,
  visibility          text,
  trust_badge         text,
  capture_source      text,
  core_fields_locked  boolean,
  created_at          timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id, t.pair, t.direction, t.result,
    t.entry_price, t.exit_price, t.stop_loss, t.take_profit,
    t.lot_size, t.pnl, t.rr_ratio,
    t.session, t.emotions, t.strategy, t.setup_grade,
    t.tags, t.notes, t.chart_path,
    t.visibility, t.trust_badge, t.capture_source,
    t.core_fields_locked, t.created_at
  FROM public.trades t
  JOIN public.profiles p ON p.id = t.user_id
  WHERE t.user_id        = profile_id
    AND p.visibility     IN ('community', 'public')
    AND t.visibility     = 'public'
    AND t.trust_badge   != 'demo'
  ORDER BY t.created_at DESC
  LIMIT lim;
$$;

-- 3. Update get_leaderboard_scores to explicitly exclude demo broker accounts.
--    Defence in depth: the scoring engine already gates demo accounts via
--    gate_live_account = false, so their score_tier is always 'none'.
--    This join makes the exclusion explicit at query time.
CREATE OR REPLACE FUNCTION get_leaderboard_scores(
  p_tier  text DEFAULT 'all',
  p_limit int  DEFAULT 50
)
RETURNS TABLE (
  user_id           uuid,
  display_name      text,
  avatar_path       text,
  username          text,
  broker_account_id uuid,
  score_tier        score_tier,
  active_score      numeric,
  pro_score         numeric,
  trade_count       integer,
  win_rate_pct      numeric,
  expectancy_pct    numeric,
  sortino_ratio     numeric,
  max_drawdown_pct  numeric,
  last_scored_at    timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    p.avatar_path,
    p.username,
    s.broker_account_id,
    s.score_tier,
    s.active_score,
    s.pro_score,
    s.trade_count,
    s.win_rate_pct,
    s.expectancy_pct,
    s.sortino_ratio,
    s.max_drawdown_pct,
    s.last_scored_at
  FROM account_scores s
  JOIN profiles      p  ON p.id  = s.user_id
  JOIN broker_accounts ba ON ba.id = s.broker_account_id
  WHERE
    p.visibility        IN ('community', 'public')
    AND s.last_scored_at IS NOT NULL
    AND ba.account_type != 'demo'
    AND (
         (p_tier = 'pro'    AND s.score_tier = 'pro')
      OR (p_tier = 'active' AND s.score_tier = 'active')
      OR (p_tier = 'all'    AND s.score_tier IN ('active', 'pro'))
    )
  ORDER BY
    CASE WHEN p_tier = 'pro'    THEN s.pro_score
         WHEN p_tier = 'active' THEN s.active_score
         ELSE CASE WHEN s.score_tier = 'pro'
                   THEN s.pro_score * 1.2
                   ELSE s.active_score END
    END DESC
  LIMIT p_limit;
$$;
