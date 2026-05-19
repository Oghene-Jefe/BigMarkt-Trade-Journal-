-- =============================================================================
-- 0048_drop_support_messages_users_update_policy.sql
--
-- Re-drop the `users_update_own_messages` policy on public.support_messages.
--
-- HISTORY:
--   0033_support_chat_rls_hardening.sql  — created the policy
--   0035_support_messages_read_rpc.sql   — explicitly DROPPED it because the
--                                          policy allowed UPDATE on any column,
--                                          letting a user rewrite a message
--                                          body, flip sender_role/sender_id,
--                                          or backdate created_at. The only
--                                          legitimate user-side write is
--                                          "mark an admin message as read",
--                                          which now goes through the
--                                          mark_support_messages_read RPC
--                                          (SECURITY DEFINER, narrow WHERE).
--   0046_*                               — reintroduced the policy (regression)
--   0048 (this)                          — re-drops it.
--
-- POST-0048 STATE: support_messages has NO user-facing UPDATE policy. Users
-- only have SELECT + INSERT (own conversation, own user_id, role='user'),
-- and read-receipts flow through the SECURITY DEFINER RPC. Admins retain
-- full UPDATE via the unchanged admin_all_messages (FOR ALL) policy.
--
-- The migration is idempotent: DROP POLICY IF EXISTS is a no-op when the
-- policy is not present, so re-running against any environment is safe.
-- =============================================================================

DROP POLICY IF EXISTS "users_update_own_messages" ON public.support_messages;

-- Apply-time self-check: confirms the DROP above actually took effect and
-- nothing in THIS migration's transaction recreated the policy. This is
-- NOT a guard against future migrations — anything that runs after 0048
-- can reintroduce the policy without tripping this assertion. To prevent
-- a future regression, add a CI step that runs `pg_policies` after every
-- migration apply and fails the build if `users_update_own_messages` is
-- back on `support_messages`. (See CI guard recommendation in the audit
-- report.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'support_messages'
      AND policyname = 'users_update_own_messages'
  ) THEN
    RAISE EXCEPTION
      '0048: users_update_own_messages still present on support_messages '
      'immediately after DROP — something inside this migration is racing '
      'with itself. Investigate before deploying.';
  END IF;
END $$;
