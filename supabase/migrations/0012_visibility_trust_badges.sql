-- 0012_visibility_trust_badges.sql
-- Session 1: Visibility controls + trust badge schema
-- Adds journal_mode to profiles
-- Adds trust_badge, capture_source, core_fields_locked, auto_approved to trades
-- Updates get_public_trades and get_leaderboard RPCs

-- ─── 1. journal_mode on profiles ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS journal_mode text NOT NULL DEFAULT 'manual'
    CHECK (journal_mode IN ('manual', 'automated', 'hybrid'));

-- ─── 2. Trust badge columns on trades ───────────────────────────────────────
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS trust_badge text NOT NULL DEFAULT 'manual'
    CHECK (trust_badge IN ('manual', 'auto_verified', 'draft', 'edited', 'prop_firm'));

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS capture_source text NOT NULL DEFAULT 'manual'
    CHECK (capture_source IN ('manual', 'ea', 'websocket'));

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT true;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS core_fields_locked boolean NOT NULL DEFAULT false;

-- ─── 3. Backfill all existing trades as manual ───────────────────────────────
UPDATE public.trades
  SET
    trust_badge      = 'manual',
    capture_source   = 'manual',
    core_fields_locked = false,
    auto_approved    = true
  WHERE trust_badge = 'manual';

-- ─── 4. Update get_public_trades RPC to include trust_badge ─────────────────
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
  WHERE t.user_id   = profile_id
    AND p.visibility IN ('community', 'public')
    AND t.visibility = 'public'
  ORDER BY t.created_at DESC
  LIMIT lim;
$$;

-- ─── 5. Update get_leaderboard RPC to include journal_mode ──────────────────
CREATE OR REPLACE FUNCTION public.get_leaderboard(mode text DEFAULT 'quality', lim int DEFAULT 50)
RETURNS TABLE (
  id           uuid,
  display_name text,
  avatar_path  text,
  visibility   text,
  journal_mode text,
  trade_count  bigint,
  win_rate     numeric,
  total_pnl    numeric,
  avg_rr       numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    p.avatar_path,
    p.visibility,
    p.journal_mode,
    COUNT(t.id)                                                          AS trade_count,
    ROUND(
      100.0 * SUM(CASE WHEN t.result = 'WIN' THEN 1 ELSE 0 END)
        / NULLIF(COUNT(t.id), 0), 1
    )                                                                    AS win_rate,
    COALESCE(SUM(t.pnl), 0)                                             AS total_pnl,
    ROUND(COALESCE(AVG(t.rr_ratio), 0), 2)                              AS avg_rr
  FROM public.profiles p
  LEFT JOIN public.trades t
    ON  t.user_id    = p.id
    AND t.visibility = 'public'
    AND t.trust_badge = 'auto_verified'
  WHERE p.visibility IN ('community', 'public')
  GROUP BY p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode
  HAVING COUNT(t.id) > 0
  ORDER BY
    CASE
      WHEN mode = 'earners' THEN COALESCE(SUM(t.pnl), 0)
      ELSE ROUND(
        100.0 * SUM(CASE WHEN t.result = 'WIN' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(t.id), 0), 1
      )
    END DESC NULLS LAST
  LIMIT lim;
END;
$$;
