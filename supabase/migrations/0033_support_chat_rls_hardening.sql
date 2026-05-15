-- =============================================================================
-- 0033_support_chat_rls_hardening.sql
--
-- Tightens RLS on support_messages so a regular user cannot:
--   (a) impersonate another user by setting sender_id ≠ auth.uid(), or
--   (b) impersonate an admin by setting sender_role = 'admin'.
--
-- The original policy in 0029 used a single permissive FOR ALL rule that only
-- enforced conversation ownership. INSERTs from the user-side client could
-- write any sender_id/sender_role as long as the conversation belonged to
-- the caller — a privilege-escalation hole for the support thread.
--
-- This migration replaces that single rule with explicit per-operation
-- policies. The admin override policy (admin_all_messages) from 0029 is
-- unchanged and continues to allow admins to insert admin replies.
-- =============================================================================

DROP POLICY IF EXISTS "users_own_messages" ON public.support_messages;

-- SELECT: users can read messages in their own conversations.
CREATE POLICY "users_select_own_messages" ON public.support_messages
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
    )
  );

-- UPDATE: users can mark messages in their own conversations as read.
-- WITH CHECK mirrors USING so they can't reassign messages elsewhere.
CREATE POLICY "users_update_own_messages" ON public.support_messages
  FOR UPDATE
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

-- INSERT: users can only post 'user'-role messages on their own behalf into
-- their own conversation. Three checks must all hold:
--   1. sender_id matches the caller (no impersonation),
--   2. sender_role is 'user' (no admin spoofing),
--   3. conversation belongs to the caller.
CREATE POLICY "users_insert_own_messages" ON public.support_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'user'
    AND conversation_id IN (
      SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
    )
  );

-- DELETE: no policy → deletes from the user role are denied by default.
-- Admins retain DELETE via admin_all_messages (FOR ALL).
