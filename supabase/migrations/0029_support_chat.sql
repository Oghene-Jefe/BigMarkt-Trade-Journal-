-- Support chat: per-user conversations + messages, with admin override.
-- Admin RLS calls the existing public.is_admin(uid) RPC (backed by the
-- admin_users table) rather than a profiles.is_admin column — that's the
-- repo-wide pattern and the single source of truth for admin status.

CREATE TABLE IF NOT EXISTS support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_by_user BOOLEAN NOT NULL DEFAULT FALSE,
  unread_by_admin BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id
  ON support_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_support_conversations_status
  ON support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id
  ON support_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at
  ON support_messages(created_at DESC);

ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Users see/insert/update only their own conversations.
CREATE POLICY "users_own_conversations" ON support_conversations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users access messages in conversations they own.
CREATE POLICY "users_own_messages" ON support_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM support_conversations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM support_conversations WHERE user_id = auth.uid()
    )
  );

-- Admin override — uses the existing is_admin() RPC.
CREATE POLICY "admin_all_conversations" ON support_conversations
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_all_messages" ON support_messages
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Keep conversation row in sync with its latest message. SECURITY DEFINER
-- because users can only see their own conversations under RLS, but the
-- trigger must update unread flags regardless of who sent the message.
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_conversations
  SET
    updated_at = NOW(),
    last_message_at = NOW(),
    last_message_preview = LEFT(NEW.body, 100),
    unread_by_admin = CASE WHEN NEW.sender_role = 'user' THEN TRUE ELSE unread_by_admin END,
    unread_by_user = CASE WHEN NEW.sender_role = 'admin' THEN TRUE ELSE unread_by_user END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_support_message ON support_messages;
CREATE TRIGGER on_new_support_message
  AFTER INSERT ON support_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Realtime only on messages — the trigger above takes care of conversation
-- row updates, so we don't need a second channel.
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
