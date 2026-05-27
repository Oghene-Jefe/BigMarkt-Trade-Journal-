ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS source        TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS verified      BOOLEAN DEFAULT false;

COMMENT ON COLUMN trades.source IS 'ea = automated from MT5, manual = user entered';
COMMENT ON COLUMN trades.verified IS 'true = came from verified EA ingest with valid HMAC signature';
