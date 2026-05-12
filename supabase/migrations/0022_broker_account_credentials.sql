-- Migration 0022: optional broker account credentials
ALTER TABLE broker_accounts ADD COLUMN account_number TEXT;
ALTER TABLE broker_accounts ADD COLUMN readonly_password TEXT;
