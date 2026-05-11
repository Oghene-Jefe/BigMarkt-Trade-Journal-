-- 0018_ea_trade_columns.sql
-- Adds MT4/MT5 EA-specific columns to trades + unique index for upsert

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS ticket      BIGINT,
  ADD COLUMN IF NOT EXISTS open_time   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_time  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS swap        NUMERIC,
  ADD COLUMN IF NOT EXISTS commission  NUMERIC,
  ADD COLUMN IF NOT EXISTS magic       INTEGER,
  ADD COLUMN IF NOT EXISTS comment     TEXT;

-- Unique index on (user_id, ticket) to support upsert conflict resolution
-- Partial index: only rows where ticket IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_user_ticket
  ON trades (user_id, ticket)
  WHERE ticket IS NOT NULL;
