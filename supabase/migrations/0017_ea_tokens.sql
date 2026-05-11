-- 0017_ea_tokens.sql
-- EA authentication tokens for MQL5 bridge

CREATE TABLE ea_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL DEFAULT 'My EA',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

-- Index for fast lookup by hash on every ingest request
CREATE INDEX idx_ea_tokens_hash ON ea_tokens (token_hash);

-- Index for listing a user's tokens
CREATE INDEX idx_ea_tokens_user ON ea_tokens (user_id);

ALTER TABLE ea_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY "ea_tokens: select own"
  ON ea_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "ea_tokens: insert own"
  ON ea_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens (for revoke)
CREATE POLICY "ea_tokens: update own"
  ON ea_tokens FOR UPDATE
  USING (auth.uid() = user_id);
