-- 0019_ea_connection_log.sql
-- Audit log of EA WebSocket connect/disconnect events.

CREATE TABLE public.ea_connection_log (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id   UUID NOT NULL REFERENCES public.ea_tokens(id) ON DELETE CASCADE,
  event      TEXT NOT NULL CHECK (event IN ('connected', 'disconnected')),
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ea_connection_log IS 'Audit log of EA WebSocket connections and disconnections';

CREATE INDEX idx_ea_connection_log_user_created
  ON public.ea_connection_log (user_id, created_at DESC);

CREATE INDEX idx_ea_connection_log_token_created
  ON public.ea_connection_log (token_id, created_at DESC);

ALTER TABLE public.ea_connection_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own connection history; only the service role writes.
CREATE POLICY "ea_connection_log: select own"
  ON public.ea_connection_log FOR SELECT
  USING (auth.uid() = user_id);
