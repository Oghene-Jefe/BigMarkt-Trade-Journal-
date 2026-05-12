-- Migration 0020: broker_accounts table
-- Each user can have multiple broker accounts
-- Each account has its own journal_mode, account_type, and prop_firm flag

CREATE TYPE account_type AS ENUM ('live', 'demo', 'prop_firm');

CREATE TABLE broker_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,                        -- e.g. "IC Markets Live", "FTMO Challenge"
  broker_slug   TEXT NOT NULL,                        -- matches slug in web/lib/brokers.ts
  account_type  account_type NOT NULL DEFAULT 'live',
  journal_mode  TEXT NOT NULL DEFAULT 'manual'
                CHECK (journal_mode IN ('manual', 'automated')),
  is_prop_firm  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prop firm accounts are always manual (journal-only, copy execution disabled)
ALTER TABLE broker_accounts
  ADD CONSTRAINT prop_firm_must_be_manual
  CHECK (NOT is_prop_firm OR journal_mode = 'manual');

-- RLS
ALTER TABLE broker_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own accounts"
  ON broker_accounts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast per-user lookup
CREATE INDEX idx_broker_accounts_user_id ON broker_accounts(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_broker_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_broker_accounts_updated_at
  BEFORE UPDATE ON broker_accounts
  FOR EACH ROW EXECUTE FUNCTION update_broker_accounts_updated_at();

-- Link trades to a broker account (nullable — existing trades unaffected)
ALTER TABLE trades
  ADD COLUMN broker_account_id UUID REFERENCES broker_accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_trades_broker_account_id ON trades(broker_account_id);
