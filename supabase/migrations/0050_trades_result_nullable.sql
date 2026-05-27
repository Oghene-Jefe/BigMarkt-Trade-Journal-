-- 0050_trades_result_nullable.sql
-- Makes the `result` column nullable so that open (ENTRY_IN) trades can be
-- inserted without a result — the result is only meaningful on close (ENTRY_OUT).
--
-- The NOT NULL constraint was originally correct for manual trades (which are
-- always fully specified at entry time), but EA-sourced open deals arrive in
-- two separate events: ENTRY_IN (open, no result yet) and ENTRY_OUT (close,
-- result derived from profit). The INSERT on ENTRY_IN has no profit to derive
-- a result from, so the column must allow NULL.
--
-- Existing rows are unaffected (they all have a result value already).
-- The CHECK constraint is retained — when result IS NOT NULL it must still
-- be one of ('WIN', 'LOSS', 'BE').

ALTER TABLE public.trades
  ALTER COLUMN result DROP NOT NULL;
