-- 0047_trades_immutable_lock_and_leaderboard_redaction.sql
--
-- Closes two HIGH findings from docs/security-audit-2026-05-18-rescan.md:
--
--   N-H1 Direct supabase-JS PATCH on `trades` bypasses the application-
--        layer `core_fields_locked` check. The trades_self_update RLS
--        policy is column-agnostic — USING/WITH CHECK (user_id = auth.uid())
--        — so an authenticated user can run
--          supabase.from('trades').update({trust_badge:'auto_verified',
--                                          pnl: 99999, core_fields_locked:false})
--                                  .eq('id', tradeId)
--        directly from devtools and rewrite trust_badge, PnL, ticket, and
--        every other field the EA originally stamped. This defeats the
--        entire trust badge system (H-6a) from the consumer side and
--        undermines the leaderboard.
--
--        Fix: BEFORE UPDATE trigger that rejects mutations to any of the
--        core-fields columns when OLD.core_fields_locked = true and the
--        caller is NOT the service role (i.e. EA ingest path) and NOT an
--        admin (admin override RLS from 0044 lets the admin moderate).
--
--   N-H5 `get_leaderboard` RPC is GRANTED to anon and returns total_pnl
--        for community-tier profiles. Same disclosure class as M-18
--        (which closed the per-profile RPCs in migration 0046) but the
--        leaderboard RPC was missed. Drop total_pnl, gate community-tier
--        rows on auth.uid() IS NOT NULL.
--
-- All statements idempotent. Safe to re-run.

-- =============================================================================
-- N-H1: trades core-fields immutability trigger
-- =============================================================================
--
-- The trigger fires BEFORE UPDATE. If the OLD row has core_fields_locked = true,
-- the NEW row's protected columns must match the OLD row's values. The list
-- mirrors the audit's recommendation:
--   trust_badge, capture_source, core_fields_locked, ticket, pnl,
--   entry_price, exit_price, open_time, close_time, lot_size, direction,
--   pair, swap, commission, broker_account_id, auto_approved.
--
-- Bypass paths (intentional):
--   • Service role (EA ingest writes via supabaseAdmin()) — needed so the
--     EA pipeline can keep capturing trade updates from MT4/MT5
--     (close_time / exit_price / pnl on the same ticket).
--   • Admin RLS override (migration 0044 trades_admin_update) — needed for
--     moderation. Detected via public.is_admin(auth.uid()).
--
-- Anything else: the trigger raises 'core fields are locked' (SQLSTATE
-- 'P0001'). The route's session-bound client and any direct PostgREST
-- PATCH from the browser both hit this raise.

CREATE OR REPLACE FUNCTION public.trades_enforce_locked_core_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
  v_is_admin boolean;
BEGIN
  -- Skip the check entirely if the row is not locked.
  IF COALESCE(OLD.core_fields_locked, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- The service role bypasses RLS and is the EA ingest path. Identify by
  -- current_user role name. In Supabase the service role connects as
  -- `service_role`; regular user-token connections come in as
  -- `authenticator` and SET ROLE to `authenticated` per request.
  v_role := current_setting('role', true);
  IF v_role = 'service_role' OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admin override — same gate the admin_update RLS policy uses.
  v_is_admin := COALESCE(public.is_admin(auth.uid()), false);
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Compare each protected column. If any changed, reject the UPDATE.
  IF NEW.trust_badge        IS DISTINCT FROM OLD.trust_badge        THEN RAISE EXCEPTION 'core fields are locked: trust_badge';        END IF;
  IF NEW.capture_source     IS DISTINCT FROM OLD.capture_source     THEN RAISE EXCEPTION 'core fields are locked: capture_source';     END IF;
  IF NEW.core_fields_locked IS DISTINCT FROM OLD.core_fields_locked THEN RAISE EXCEPTION 'core fields are locked: core_fields_locked'; END IF;
  IF NEW.ticket             IS DISTINCT FROM OLD.ticket             THEN RAISE EXCEPTION 'core fields are locked: ticket';             END IF;
  IF NEW.pnl                IS DISTINCT FROM OLD.pnl                THEN RAISE EXCEPTION 'core fields are locked: pnl';                END IF;
  IF NEW.entry_price        IS DISTINCT FROM OLD.entry_price        THEN RAISE EXCEPTION 'core fields are locked: entry_price';        END IF;
  IF NEW.exit_price         IS DISTINCT FROM OLD.exit_price         THEN RAISE EXCEPTION 'core fields are locked: exit_price';         END IF;
  IF NEW.open_time          IS DISTINCT FROM OLD.open_time          THEN RAISE EXCEPTION 'core fields are locked: open_time';          END IF;
  IF NEW.close_time         IS DISTINCT FROM OLD.close_time         THEN RAISE EXCEPTION 'core fields are locked: close_time';         END IF;
  IF NEW.lot_size           IS DISTINCT FROM OLD.lot_size           THEN RAISE EXCEPTION 'core fields are locked: lot_size';           END IF;
  IF NEW.direction          IS DISTINCT FROM OLD.direction          THEN RAISE EXCEPTION 'core fields are locked: direction';          END IF;
  IF NEW.pair               IS DISTINCT FROM OLD.pair               THEN RAISE EXCEPTION 'core fields are locked: pair';               END IF;
  IF NEW.swap               IS DISTINCT FROM OLD.swap               THEN RAISE EXCEPTION 'core fields are locked: swap';               END IF;
  IF NEW.commission         IS DISTINCT FROM OLD.commission         THEN RAISE EXCEPTION 'core fields are locked: commission';         END IF;
  IF NEW.broker_account_id  IS DISTINCT FROM OLD.broker_account_id  THEN RAISE EXCEPTION 'core fields are locked: broker_account_id';  END IF;
  IF NEW.auto_approved      IS DISTINCT FROM OLD.auto_approved      THEN RAISE EXCEPTION 'core fields are locked: auto_approved';      END IF;

  -- Mutable fields (visibility, notes, emotions, strategy, tags,
  -- setup_grade, chart_path, session, rr_ratio if user-set on manual,
  -- etc.) fall through and the update proceeds.
  RETURN NEW;
END;
$$;

-- Attach the trigger. DROP first so re-running re-binds cleanly.
DROP TRIGGER IF EXISTS trades_enforce_locked_core_fields_trg ON public.trades;
CREATE TRIGGER trades_enforce_locked_core_fields_trg
  BEFORE UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.trades_enforce_locked_core_fields();

COMMENT ON FUNCTION public.trades_enforce_locked_core_fields IS
  'Audit N-H1. Rejects updates to core trade fields when core_fields_locked=true. '
  'Service role and admins bypass — needed for EA ingest and moderation. Closes '
  'the direct-PostgREST PATCH bypass of the application-layer lock.';

-- =============================================================================
-- N-H5: get_leaderboard — drop total_pnl + add community auth gate
-- =============================================================================
--
-- The function is granted to anon (homepage caller). Today it returns
-- total_pnl for every community-or-public profile. After this migration:
--   - total_pnl removed from RETURNS TABLE and SELECT list
--   - community-tier rows admitted only when auth.uid() IS NOT NULL
--   - the 'earners' mode ordering re-keyed on AVG(rr_ratio) since
--     total_pnl is no longer materialised (alternative: drop 'earners'
--     entirely — the homepage doesn't use it today)
--
-- Notes:
--   - Adds win_rate as a sensible fallback ORDER BY for 'earners' mode
--     so the existing caller doesn't NPE on a missing column.
--   - GRANT statement re-asserted so EXECUTE is to authenticated+anon
--     (anon is intentional — homepage is anon-reachable).

DROP FUNCTION IF EXISTS public.get_leaderboard(text, int);
CREATE OR REPLACE FUNCTION public.get_leaderboard(mode text DEFAULT 'quality', lim int DEFAULT 50)
RETURNS TABLE (
  id           uuid,
  display_name text,
  avatar_path  text,
  visibility   text,
  journal_mode text,
  trade_count  bigint,
  win_rate     numeric,
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
    ROUND(COALESCE(AVG(t.rr_ratio), 0), 2)                              AS avg_rr
  FROM public.profiles p
  LEFT JOIN public.trades t
    ON  t.user_id    = p.id
    AND t.visibility = 'public'
    AND t.trust_badge = 'auto_verified'
  WHERE (
    p.visibility = 'public'
    OR (p.visibility = 'community' AND auth.uid() IS NOT NULL)
  )
  GROUP BY p.id, p.display_name, p.avatar_path, p.visibility, p.journal_mode
  HAVING COUNT(t.id) > 0
  ORDER BY
    CASE
      WHEN mode = 'earners' THEN ROUND(COALESCE(AVG(t.rr_ratio), 0), 2)
      ELSE ROUND(
        100.0 * SUM(CASE WHEN t.result = 'WIN' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(t.id), 0), 1
      )
    END DESC NULLS LAST
  LIMIT lim;
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, int) TO authenticated, anon;

COMMENT ON FUNCTION public.get_leaderboard IS
  'Public leaderboard RPC. Audit N-H5: total_pnl removed (was '
  'reverse-engineering a public starting balance with growth_pct), and '
  'community-tier rows require auth.uid() IS NOT NULL.';

-- =============================================================================
-- End of migration 0047
-- =============================================================================
