-- Migration 0057: EA v2.5.0 balance/equity passthrough + return capture
--
-- EA v2.5.0 sends three OPTIONAL unsigned-passthrough fields on every payload
-- (account_balance, account_equity, account_currency) and a new
-- "position_modify" event that carries live SL/TP changes on an open position.
--
-- This migration only adds nullable columns to store that data. No backfill,
-- no constraints, no triggers — existing rows are untouched (all NULL).
--
--   trades:
--     balance_at_open   — account balance snapshot at the fill (ENTRY_IN)
--     equity_at_open    — account equity snapshot at the fill (ENTRY_IN)
--     account_currency  — deposit currency reported by the EA (e.g. 'USD')
--     return_pct        — (pnl / balance_at_open) * 100, set on close (ENTRY_OUT)
--
--   broker_accounts:
--     starting_balance  — first-seen balance baseline (for growth %)
--     current_balance   — latest balance reported by the EA
--     current_equity    — latest equity reported by the EA
--     account_currency  — deposit currency reported by the EA
--     balance_updated_at — when current_balance/equity were last refreshed

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS balance_at_open  numeric,
  ADD COLUMN IF NOT EXISTS equity_at_open   numeric,
  ADD COLUMN IF NOT EXISTS account_currency text,
  ADD COLUMN IF NOT EXISTS return_pct       numeric;

ALTER TABLE public.broker_accounts
  ADD COLUMN IF NOT EXISTS starting_balance   numeric,
  ADD COLUMN IF NOT EXISTS current_balance    numeric,
  ADD COLUMN IF NOT EXISTS current_equity     numeric,
  ADD COLUMN IF NOT EXISTS account_currency   text,
  ADD COLUMN IF NOT EXISTS balance_updated_at timestamptz;
