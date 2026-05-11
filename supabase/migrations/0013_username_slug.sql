-- 0013_username_slug.sql
-- Session 2: adds username slug to profiles for @username routing
-- Adds followers_only trade visibility option

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE;

CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_visibility_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_visibility_check
    CHECK (visibility IN ('private', 'public', 'exclude', 'followers_only'));

CREATE OR REPLACE FUNCTION public.get_profile_by_username(slug text)
RETURNS TABLE (
  id uuid, display_name text, avatar_path text,
  visibility text, journal_mode text, username text,
  trade_count bigint, win_rate numeric, total_pnl numeric
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode, p.username,
    COUNT(t.id) AS trade_count,
    ROUND(100.0 * SUM(CASE WHEN t.result = 'WIN' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id),0), 1) AS win_rate,
    COALESCE(SUM(t.pnl), 0) AS total_pnl
  FROM public.profiles p
  LEFT JOIN public.trades t ON t.user_id = p.id AND t.visibility = 'public'
  WHERE lower(p.username) = lower(slug)
    AND p.visibility IN ('community', 'public')
  GROUP BY p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode, p.username;
$$;

-- Update get_public_profile to also return journal_mode and username
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE (
  id uuid, display_name text, avatar_path text,
  visibility text, journal_mode text, username text,
  trade_count bigint, win_rate numeric, total_pnl numeric, growth_pct numeric
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode, p.username,
    COUNT(t.id) AS trade_count,
    ROUND(100.0 * SUM(CASE WHEN t.result = 'WIN' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id),0), 1) AS win_rate,
    COALESCE(SUM(t.pnl), 0) AS total_pnl,
    CASE
      WHEN p.starting_balance > 0 THEN
        ROUND(100.0 * (COALESCE(SUM(t.pnl), 0) / p.starting_balance), 2)
      ELSE NULL
    END AS growth_pct
  FROM public.profiles p
  LEFT JOIN public.trades t ON t.user_id = p.id AND t.visibility = 'public'
  WHERE p.id = profile_id
    AND p.visibility IN ('community', 'public')
  GROUP BY p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode, p.username, p.starting_balance;
$$;
