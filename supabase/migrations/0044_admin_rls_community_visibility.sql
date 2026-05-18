-- 0044_admin_rls_community_visibility.sql
--
-- Closes three audit findings from docs/security-audit-2026-05-17.md:
--
--   H-2  Admin direct-table writes silently no-op. banUserAction,
--        adminDeleteTradeAction, and admin trades listing all match
--        zero rows under the current RLS because profiles/trades only
--        have admin SELECT, not UPDATE/DELETE/cross-user SELECT for
--        trades. Add admin override policies gated on is_admin().
--
--   H-16 Community-tier profiles and trades are scrapeable by
--        anonymous viewers despite onboarding/profile-settings copy
--        promising "logged-in BigMarkt members can see your stats".
--        Tighten get_profile_by_username + get_public_trades so
--        community-tier rows require an authenticated caller; public
--        tier stays anon-readable.
--
--   M-2  ea_tokens UPDATE policy in 0017 lacks WITH CHECK, so a user
--        can UPDATE their own token row and reassign user_id to a
--        victim. Add the explicit WITH CHECK constraint.
--
-- All statements idempotent. Safe to re-run against prod.

-- =============================================================================
-- H-2: Admin override RLS policies on profiles and trades
-- =============================================================================
-- Existing state (before this migration):
--   profiles: only profiles_self_update (id = auth.uid()) for UPDATE.
--             profiles_admin_select (0036) gives admins SELECT cross-user.
--   trades:  only user-own SELECT/INSERT/UPDATE/DELETE.
--            No admin override at all.
--
-- After this migration:
--   profiles: admins can UPDATE any row (banUserAction, etc.).
--             DELETE still goes through the admin_purge_user_data RPC.
--   trades:  admins can SELECT, UPDATE, DELETE any row.
--
-- Policies are OR-combined with the existing user-own policies, so a
-- user's UPDATE on their own profile still works; an admin's UPDATE on
-- any profile also works.

-- profiles: admin override UPDATE
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- trades: admin override SELECT (cross-user moderation reads)
DROP POLICY IF EXISTS "trades_admin_select" ON public.trades;
CREATE POLICY "trades_admin_select"
  ON public.trades
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- trades: admin override UPDATE (flag/unflag, edit moderation)
DROP POLICY IF EXISTS "trades_admin_update" ON public.trades;
CREATE POLICY "trades_admin_update"
  ON public.trades
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- trades: admin override DELETE (adminDeleteTradeAction)
DROP POLICY IF EXISTS "trades_admin_delete" ON public.trades;
CREATE POLICY "trades_admin_delete"
  ON public.trades
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- =============================================================================
-- H-16: Community visibility requires an authenticated caller
-- =============================================================================
-- Both RPCs are SECURITY DEFINER (run as postgres) but auth.uid() still
-- reflects the calling user's JWT claim (NULL for anon). The fix uses that
-- claim to admit community-tier rows only when the caller is logged in.
-- Public-tier rows stay anonymous-readable for share links etc.
--
-- Defence-in-depth: the explicit REVOKE + GRANT block at the end of each
-- function locks down which roles can EXECUTE the RPC. Codifies the
-- previously implicit PUBLIC grant from 0013 (audit L-11) and matches the
-- pattern in 0008.

DROP FUNCTION IF EXISTS public.get_profile_by_username(text);
CREATE OR REPLACE FUNCTION public.get_profile_by_username(slug text)
RETURNS TABLE (
  id uuid, display_name text, avatar_path text,
  visibility text, journal_mode text, username text,
  trade_count bigint, win_rate numeric, total_pnl numeric
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  -- Visibility gate:
  --   • public      → readable by anyone (including anonymous viewers)
  --   • community   → readable only by authenticated callers
  --   • private     → never returned by this function (no row matches)
  --
  -- Audit H-16: previously this admitted community-tier rows for any
  -- caller, contradicting the onboarding promise that community profiles
  -- are visible only to logged-in BigMarkt members.
  SELECT
    p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode, p.username,
    COUNT(t.id) AS trade_count,
    ROUND(100.0 * SUM(CASE WHEN t.result = 'WIN' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id),0), 1) AS win_rate,
    COALESCE(SUM(t.pnl), 0) AS total_pnl
  FROM public.profiles p
  LEFT JOIN public.trades t ON t.user_id = p.id AND t.visibility = 'public'
  WHERE lower(p.username) = lower(slug)
    AND (
      p.visibility = 'public'
      OR (p.visibility = 'community' AND auth.uid() IS NOT NULL)
    )
  GROUP BY p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode, p.username;
$$;

REVOKE ALL ON FUNCTION public.get_profile_by_username(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_profile_by_username(text) TO authenticated, anon;

DROP FUNCTION IF EXISTS public.get_public_trades(uuid, int);
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
  -- Same visibility gate as get_profile_by_username: anon callers only
  -- see trades belonging to public-tier profiles. Demo and prop-firm
  -- trust badges follow their existing rules (demo excluded entirely).
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
    AND t.visibility     = 'public'
    AND t.trust_badge   != 'demo'
    AND (
      p.visibility = 'public'
      OR (p.visibility = 'community' AND auth.uid() IS NOT NULL)
    )
  ORDER BY t.created_at DESC
  LIMIT lim;
$$;

REVOKE ALL ON FUNCTION public.get_public_trades(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_trades(uuid, int) TO authenticated, anon;

-- =============================================================================
-- M-2: ea_tokens UPDATE must constrain the NEW row's user_id
-- =============================================================================
-- 0017 created `ea_tokens: update own` with only USING (auth.uid() = user_id).
-- Without WITH CHECK, the row's NEW user_id is unconstrained — a user can
-- UPDATE their token row and reassign user_id to a victim, then the EA
-- pipeline starts attributing trades to the victim's account.
--
-- Adding WITH CHECK forces the new user_id to equal auth.uid(), so the
-- reassignment is rejected at the policy layer.

DROP POLICY IF EXISTS "ea_tokens: update own" ON public.ea_tokens;
CREATE POLICY "ea_tokens: update own"
  ON public.ea_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- End of migration 0044
-- =============================================================================
