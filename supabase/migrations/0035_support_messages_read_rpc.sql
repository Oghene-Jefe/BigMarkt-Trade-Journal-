-- =============================================================================
-- 0035_support_messages_read_rpc.sql
--
-- Replaces the broad `users_update_own_messages` policy (0033) with a narrow
-- SECURITY DEFINER RPC. The old policy allowed any authenticated user to
-- UPDATE any column on any message inside a conversation they owned — so a
-- user could rewrite the body, flip sender_role/sender_id, or backdate a
-- message after the fact. The only legitimate user-side write is "mark an
-- admin message as read", which now goes through this RPC.
--
-- After this migration, support_messages has no user-facing UPDATE policy,
-- so direct .update() from the browser is blocked by RLS. Admins retain
-- full UPDATE via the unchanged admin_all_messages policy (FOR ALL).
-- =============================================================================

-- 1. The RPC: marks admin messages in the caller's conversation as read.
--
--    SECURITY DEFINER lets the function update rows the caller can't write
--    directly via RLS, but the function body re-checks that auth.uid() owns
--    the conversation before touching anything. WHERE clause also restricts
--    the update to admin-role messages with read_at IS NULL, so the function
--    can only ever flip read_at from null → now() on admin replies. It cannot
--    touch body / sender_id / sender_role / conversation_id / created_at.
CREATE OR REPLACE FUNCTION public.mark_support_messages_read(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT user_id INTO v_owner
  FROM public.support_conversations
  WHERE id = p_conversation_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;

  IF v_owner <> v_uid THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.support_messages
    SET read_at = now()
    WHERE conversation_id = p_conversation_id
      AND sender_role = 'admin'
      AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Only authenticated callers can invoke it. anon (logged-out) gets nothing.
REVOKE ALL ON FUNCTION public.mark_support_messages_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_support_messages_read(uuid) TO authenticated;

-- 2. Drop the broad user UPDATE policy from 0033. Users now only have SELECT
--    and INSERT on support_messages; UPDATE flows through the RPC above.
DROP POLICY IF EXISTS "users_update_own_messages" ON public.support_messages;
