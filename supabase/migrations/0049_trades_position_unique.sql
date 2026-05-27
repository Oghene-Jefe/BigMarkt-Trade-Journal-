-- Drop the non-unique index created in 0021 (if it exists)
DROP INDEX IF EXISTS idx_trades_user_position;

-- Create a partial unique index so ON CONFLICT (user_id, position_id) works.
-- Partial (WHERE position_id IS NOT NULL) so manual trades with null position_id
-- are not affected by the uniqueness constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_user_position_unique
  ON trades(user_id, position_id)
  WHERE position_id IS NOT NULL;
