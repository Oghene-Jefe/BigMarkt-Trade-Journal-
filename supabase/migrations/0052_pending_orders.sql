-- Migration 0052: Pending order tracking columns
-- Adds three columns to trades to support pending order lifecycle events
-- sent by the EA v2.2.0 TRADE_TRANSACTION_ORDER_ADD/UPDATE/DELETE handlers.
--
-- order_ticket  — the MT5 order ticket (distinct from the deal ticket stored
--                 in the existing `ticket` column). Used as the correlation key
--                 to link order_add → order_update → order_delete → deal fill.
--
-- event_type    — the originating EA event:
--                   'market_open'   — DEAL_ENTRY_IN deal (existing path)
--                   'market_close'  — DEAL_ENTRY_OUT deal (existing path)
--                   'order_add'     — pending order placed
--                   'order_update'  — pending order modified (price/sl/tp)
--                   'order_delete'  — pending order cancelled or filled
--
-- order_status  — the lifecycle state of the order:
--                   'pending'       — placed, waiting to be triggered
--                   'modified'      — updated by order_update event
--                   'filled'        — order executed, deal_entry='in' received
--                   'cancelled'     — order_delete received without a fill

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS order_ticket  TEXT,
  ADD COLUMN IF NOT EXISTS event_type    TEXT,
  ADD COLUMN IF NOT EXISTS order_status  TEXT;

-- Index for fast lookup by (user_id, order_ticket) in the order lifecycle
-- update and delete paths in the ingest route.
CREATE INDEX IF NOT EXISTS trades_user_order_ticket_idx
  ON trades (user_id, order_ticket)
  WHERE order_ticket IS NOT NULL;

-- Optional check constraint — comment out if you need other values during dev.
-- ALTER TABLE trades
--   ADD CONSTRAINT trades_order_status_check
--   CHECK (order_status IN ('pending','modified','filled','cancelled'));
