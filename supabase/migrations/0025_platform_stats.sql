-- 0025_platform_stats.sql
-- Anon-callable aggregate counts for the marketing homepage. No user data
-- exposed — only three integers. SECURITY DEFINER so it can see all rows
-- regardless of RLS / visibility filters.

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE (
  total_traders         integer,
  auto_verified_trades  integer,
  public_leaders        integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.profiles)                                       AS total_traders,
    (SELECT count(*)::int FROM public.trades WHERE trust_badge = 'auto_verified')     AS auto_verified_trades,
    (SELECT count(*)::int FROM public.profiles
       WHERE visibility IN ('community','public')
         AND journal_mode = 'automated')                                              AS public_leaders;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO authenticated, anon;
