-- =============================================================================
-- 0036_admin_profiles_select.sql
--
-- profiles RLS (0002) only allows a user to SELECT their own row. Admin
-- panels that read profiles directly — the support inbox conversation
-- view, the user-management table, the disputes list, etc. — were
-- silently getting back NULL for every cross-user lookup, then falling
-- through to "Trader" / "—" placeholders. Support admins couldn't see
-- who they were replying to.
--
-- This migration adds an admin override SELECT policy, matching the
-- pattern used for support_conversations.admin_all_conversations and
-- support_messages.admin_all_messages: admins can see everything,
-- gated by the public.is_admin(auth.uid()) RPC.
--
-- Scope: SELECT only. Admins still can't INSERT/UPDATE/DELETE arbitrary
-- profiles directly; those paths continue to go through the SECURITY
-- DEFINER admin_* RPCs in 0010_admin_rpcs.sql.
-- =============================================================================

DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;

CREATE POLICY "profiles_admin_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
