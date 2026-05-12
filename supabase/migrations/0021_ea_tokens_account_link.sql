-- Migration 0021: link ea_tokens to broker_accounts
ALTER TABLE ea_tokens
  ADD COLUMN broker_account_id UUID REFERENCES broker_accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_ea_tokens_broker_account_id ON ea_tokens(broker_account_id);
