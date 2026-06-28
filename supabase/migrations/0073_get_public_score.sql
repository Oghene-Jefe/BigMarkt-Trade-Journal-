-- 0073_get_public_score.sql
--
-- Exposes the best score row for a public profile to anonymous callers.
-- Only fires when the profile is community/public AND a non-none tier exists.
-- SECURITY DEFINER bypasses account_scores RLS (which is owner-only).
-- No PII is returned; broker_account_id is intentionally omitted.

CREATE OR REPLACE FUNCTION get_public_score(p_profile_id uuid)
RETURNS TABLE (
  score_tier        score_tier,
  active_score      numeric,
  pro_score         numeric,
  trade_count       integer,
  win_rate_pct      numeric,
  expectancy_pct    numeric,
  max_drawdown_pct  numeric,
  last_scored_at    timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.score_tier,
    s.active_score,
    s.pro_score,
    s.trade_count,
    s.win_rate_pct,
    s.expectancy_pct,
    s.max_drawdown_pct,
    s.last_scored_at
  FROM account_scores s
  JOIN profiles p ON p.id = s.user_id
  WHERE
    s.user_id = p_profile_id
    AND p.visibility IN ('community', 'public')
    AND s.score_tier != 'none'
    AND s.last_scored_at IS NOT NULL
  ORDER BY
    -- Prefer pro row if a trader has multiple broker accounts
    CASE s.score_tier WHEN 'pro' THEN 0 ELSE 1 END
  LIMIT 1;
$$;
