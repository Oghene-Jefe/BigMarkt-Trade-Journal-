-- 0051_clean_orphan_trades.sql
-- Flags orphan EA trades created during debugging where ENTRY_OUT saved
-- but ENTRY_IN failed, leaving rows with entry_price = 0 or NULL.
-- These are not real complete trades and should not appear in the journal.
-- Uses visibility = 'private' to soft-delete without losing data.
-- ('exclude' is not in the visibility CHECK constraint.)

UPDATE trades
SET visibility = 'private'
WHERE source = 'ea'
  AND (entry_price = 0 OR entry_price IS NULL)
  AND status = 'closed'
  AND visibility != 'private';
