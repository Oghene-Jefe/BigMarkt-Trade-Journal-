-- 0023_performance_scores.sql
-- Dual-tier performance scoring: ACTIVE and VERIFIED PRO

-- Score tier enum
CREATE TYPE score_tier AS ENUM ('none', 'active', 'pro');

-- Main scores table — one row per broker_account
CREATE TABLE public.account_scores (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_account_id         uuid NOT NULL REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ACTIVE tier components (0-100 each)
  active_expectancy_score   numeric(5,2) DEFAULT 0,
  active_winrate_score      numeric(5,2) DEFAULT 0,
  active_drawdown_score     numeric(5,2) DEFAULT 0,
  active_regularity_score   numeric(5,2) DEFAULT 0,
  active_score              numeric(5,2) DEFAULT 0,
  active_eligible           boolean DEFAULT false,

  -- PRO tier components (0-100 each)
  pro_expectancy_score      numeric(5,2) DEFAULT 0,
  pro_sortino_score         numeric(5,2) DEFAULT 0,
  pro_drawdown_score        numeric(5,2) DEFAULT 0,
  pro_regularity_score      numeric(5,2) DEFAULT 0,
  pro_score                 numeric(5,2) DEFAULT 0,
  pro_eligible              boolean DEFAULT false,

  -- Assigned tier
  score_tier                score_tier DEFAULT 'none',

  -- Raw metrics stored for transparency display
  trade_count               integer DEFAULT 0,
  win_rate_pct              numeric(5,2) DEFAULT 0,
  avg_rr                    numeric(5,2) DEFAULT 0,
  expectancy_pct            numeric(8,4) DEFAULT 0,
  sortino_ratio             numeric(8,4) DEFAULT 0,
  max_drawdown_pct          numeric(5,2) DEFAULT 0,
  max_drawdown_weeks        integer DEFAULT 0,
  weekly_trade_cv           numeric(8,4) DEFAULT 0,
  account_history_days      integer DEFAULT 0,

  -- Gate checks stored for UI display
  gate_min_trades_active    boolean DEFAULT false,
  gate_min_days_active      boolean DEFAULT false,
  gate_positive_expectancy  boolean DEFAULT false,
  gate_automated_mode       boolean DEFAULT false,
  gate_live_account         boolean DEFAULT false,
  gate_min_trades_pro       boolean DEFAULT false,
  gate_min_days_pro         boolean DEFAULT false,
  gate_max_drawdown_pro     boolean DEFAULT false,

  last_scored_at            timestamptz,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),

  UNIQUE(broker_account_id)
);

-- RLS
ALTER TABLE public.account_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY scores_self_select ON public.account_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY scores_self_insert ON public.account_scores
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY scores_self_update ON public.account_scores
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER tg_account_scores_updated_at
  BEFORE UPDATE ON public.account_scores
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

-- Public read of scores for leaderboard (no PII — broker_account_id + scores only)
CREATE OR REPLACE FUNCTION get_leaderboard_scores(
  p_tier text DEFAULT 'all',
  p_limit int DEFAULT 50
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
  JOIN profiles p ON p.id = s.user_id
  WHERE
    p.visibility IN ('community', 'public')
    AND s.last_scored_at IS NOT NULL
    AND (
      (p_tier = 'pro'    AND s.score_tier = 'pro')
      OR (p_tier = 'active' AND s.score_tier = 'active')
      OR (p_tier = 'all'  AND s.score_tier IN ('active', 'pro'))
    )
  ORDER BY
    CASE WHEN p_tier = 'pro' THEN s.pro_score
         WHEN p_tier = 'active' THEN s.active_score
         ELSE CASE WHEN s.score_tier = 'pro' THEN s.pro_score * 1.2
                   ELSE s.active_score END
    END DESC
  LIMIT p_limit;
$$;
