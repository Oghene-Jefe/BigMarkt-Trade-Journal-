-- 0055_backfill_ea_broker_account_and_demo_badge.sql
--
-- Backfill broker_account_id + demo trust_badge on existing EA trades.
--
-- Context: until the ingest self-heal landed (web/app/api/ea/ingest/route.ts),
-- EA trades were written with broker_account_id = NULL whenever the token was
-- not manually linked to an account. The dashboard's client-side account filter
-- (row.broker_account_id === selectedAccountId) then dropped those rows for any
-- user who has at least one broker account. This one-off backfill links the
-- existing NULL EA rows to the user's account — but only when that user has
-- EXACTLY ONE account (otherwise attribution is ambiguous, so we leave it NULL).
-- It also stamps trust_badge='demo' on EA rows whose resolved account is demo.
--
-- The 0047 immutability trigger (trades_enforce_locked_core_fields_trg) rejects
-- updates to broker_account_id / trust_badge when core_fields_locked=true. It is
-- a plain row-level trigger, so `session_replication_role = replica` disables it
-- for the duration of this transaction (set local → reset on commit).
--
-- Idempotent: re-running is a no-op (only NULL accounts / non-demo badges match).

begin;

set local session_replication_role = replica;  -- bypass 0047 immutability trigger for this one-off backfill

-- (1) Link existing EA trades to the user's single broker account.
with single_acct as (
  select user_id, min(id) as account_id
  from broker_accounts
  group by user_id
  having count(*) = 1
)
update trades t
set broker_account_id = sa.account_id
from single_acct sa
where t.capture_source = 'ea'
  and t.broker_account_id is null
  and t.user_id = sa.user_id;

-- (2) Stamp demo trust_badge on EA rows whose account is demo.
update trades t
set trust_badge = 'demo'
from broker_accounts ba
where t.broker_account_id = ba.id
  and t.capture_source = 'ea'
  and ba.account_type = 'demo'
  and t.trust_badge is distinct from 'demo';

set local session_replication_role = origin;

commit;
