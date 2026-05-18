-- 0046_rls_sweep_and_public_privacy.sql
--
-- Closes three audit findings from docs/security-audit-2026-05-17.md:
--
--   M-3  Several RLS policies declared without `TO authenticated`, which
--        defaults to applying to PUBLIC including the anon role. The
--        `auth.uid() = user_id` predicate happens to fail safe for anon
--        callers (NULL = uuid → NULL/false), so this isn't immediately
--        exploitable on the affected tables. But it's a policy-pattern
--        divergence from 0002 and a footgun for any future predicate
--        that doesn't fail safe (see the brokers_public_read precedent
--        in 0030). Sweeping the known offenders here.
--
--   M-18 get_public_profile returns BOTH total_pnl AND growth_pct, which
--        lets any caller compute starting_balance = total_pnl /
--        (growth_pct/100). Users opted to publish their P&L and
--        percent-growth, not their account size. Drop total_pnl;
--        growth_pct conveys the more useful signal.
--
--   M-20 get_public_trades returns notes / emotions / strategy / tags.
--        Those are free-text fields traders use as a private diary,
--        often containing broker names, account numbers, real names,
--        mood entries. A user who flips one trade public should not
--        unknowingly expose that side-text to search engines forever.
--        Drop all four from the public RPC. setup_grade and session
--        stay — they're analytical, not personal. If sharing notes
--        becomes a real product feature later, gate it behind a new
--        per-trade `share_notes` flag separate from `visibility`.
--
-- All statements idempotent. Safe to re-run against prod.

-- =============================================================================
-- M-3: RLS policy sweep — explicit TO authenticated
-- =============================================================================
-- For each affected policy: DROP IF EXISTS, then CREATE with the same
-- USING/WITH CHECK clause but adding TO authenticated. Admin override
-- policies likewise get scoped explicitly so future tightening of the
-- default PUBLIC grant doesn't break them.
--
-- Policies left intentionally untouched:
--   - brokers_public_read (0030): is_active = TRUE is anon-readable on
--     purpose. Confirmed product intent.
--   - Anything tied to get_public_profile / get_public_trades: those
--     are SECURITY DEFINER RPCs with explicit GRANT TO authenticated,
--     anon — the access surface is the function's USING clauses, not
--     base-table RLS.

-- ea_tokens (0017) — SELECT + INSERT. UPDATE was already fixed in 0044.
DROP POLICY IF EXISTS "ea_tokens: select own" ON public.ea_tokens;
CREATE POLICY "ea_tokens: select own"
  ON public.ea_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ea_tokens: insert own" ON public.ea_tokens;
CREATE POLICY "ea_tokens: insert own"
  ON public.ea_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ea_connection_log (0019) — SELECT only; service role does the writes.
DROP POLICY IF EXISTS "ea_connection_log: select own" ON public.ea_connection_log;
CREATE POLICY "ea_connection_log: select own"
  ON public.ea_connection_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- broker_accounts (0020) — single FOR ALL policy.
DROP POLICY IF EXISTS "Users manage own accounts" ON public.broker_accounts;
CREATE POLICY "Users manage own accounts"
  ON public.broker_accounts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- support_conversations (0029) — user-own + admin override.
DROP POLICY IF EXISTS "users_own_conversations" ON public.support_conversations;
CREATE POLICY "users_own_conversations"
  ON public.support_conversations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_all_conversations" ON public.support_conversations;
CREATE POLICY "admin_all_conversations"
  ON public.support_conversations FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- support_messages — the 3 user policies from 0033 + admin override from 0029.
DROP POLICY IF EXISTS "users_select_own_messages" ON public.support_messages;
CREATE POLICY "users_select_own_messages"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_update_own_messages" ON public.support_messages;
CREATE POLICY "users_update_own_messages"
  ON public.support_messages FOR UPDATE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_insert_own_messages" ON public.support_messages;
CREATE POLICY "users_insert_own_messages"
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'user'
    AND conversation_id IN (
      SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_all_messages" ON public.support_messages;
CREATE POLICY "admin_all_messages"
  ON public.support_messages FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- badges (0031) — user-own SELECT + admin all.
DROP POLICY IF EXISTS users_own_badges ON public.badges;
CREATE POLICY users_own_badges
  ON public.badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_all_badges ON public.badges;
CREATE POLICY admin_all_badges
  ON public.badges FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =============================================================================
-- M-18: public profile RPCs — drop total_pnl
-- =============================================================================
-- growth_pct stays. Without total_pnl, viewers cannot compute the
-- trader's starting balance. The percent-growth alone is the publicly
-- useful signal.
--
-- Both public profile entry points are covered:
--   • /p/[id]      → get_public_profile(uuid)
--   • /@username   → get_profile_by_username(text)

DROP FUNCTION IF EXISTS public.get_public_profile(uuid);
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE (
  id uuid, display_name text, avatar_path text,
  visibility text, journal_mode text, username text,
  trade_count bigint, win_rate numeric, growth_pct numeric
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode, p.username,
    COUNT(t.id) AS trade_count,
    ROUND(100.0 * SUM(CASE WHEN t.result = 'WIN' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id),0), 1) AS win_rate,
    CASE
      WHEN p.starting_balance > 0 THEN
        ROUND(100.0 * (COALESCE(SUM(t.pnl), 0) / p.starting_balance), 2)
      ELSE NULL
    END AS growth_pct
  FROM public.profiles p
  LEFT JOIN public.trades t ON t.user_id = p.id AND t.visibility = 'public'
  WHERE p.id = profile_id
    AND (
      p.visibility = 'public'
      OR (p.visibility = 'community' AND auth.uid() IS NOT NULL)
    )
  GROUP BY p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode, p.username, p.starting_balance;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated, anon;

DROP FUNCTION IF EXISTS public.get_profile_by_username(text);
CREATE OR REPLACE FUNCTION public.get_profile_by_username(slug text)
RETURNS TABLE (
  id uuid, display_name text, avatar_path text,
  visibility text, journal_mode text, username text,
  trade_count bigint, win_rate numeric
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode, p.username,
    COUNT(t.id) AS trade_count,
    ROUND(100.0 * SUM(CASE WHEN t.result = 'WIN' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id),0), 1) AS win_rate
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

-- =============================================================================
-- M-20: get_public_trades — drop notes / emotions / strategy / tags
-- =============================================================================
-- These four are free-text private-diary fields. setup_grade and session
-- stay (analytical, not personal). All numeric trade stats stay. The
-- chart_path stays — chart images are signed-URL-gated separately.
--
-- The community-tier auth check added in 0044 is preserved.

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
  setup_grade         text,
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
    t.session, t.setup_grade,
    t.chart_path,
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
-- End of migration 0046
-- =============================================================================
