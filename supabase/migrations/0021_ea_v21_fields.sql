ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS position_id   TEXT,
  ADD COLUMN IF NOT EXISTS deal_entry    TEXT,
  ADD COLUMN IF NOT EXISTS close_price   NUMERIC(20,5),
  ADD COLUMN IF NOT EXISTS sl            NUMERIC(20,5),
  ADD COLUMN IF NOT EXISTS tp            NUMERIC(20,5),
  ADD COLUMN IF NOT EXISTS r_multiple    NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'closed';

CREATE INDEX IF NOT EXISTS idx_trades_user_position
  ON trades(user_id, position_id);

COMMENT ON COLUMN trades.deal_entry IS 'in = trade opened, out = trade closed, null = manual';
COMMENT ON COLUMN trades.status IS 'open | closed';
