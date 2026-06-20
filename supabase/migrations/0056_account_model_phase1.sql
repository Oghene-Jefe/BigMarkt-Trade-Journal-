-- 0056_account_model_phase1.sql
--
-- Account-model Phase 1: data foundation for "every trade belongs to an account".
--
-- (A) Drop "hybrid" journal mode. NOTE: broker_accounts.journal_mode was defined
--     in 0020 as a CHECK constraint that ONLY allows ('manual','automated') —
--     it never permitted 'hybrid'. (The legacy 'hybrid' lived on profiles.journal_mode
--     and was already retired in 0014_remove_hybrid_mode.sql.) So there is no enum
--     value to drop and no CHECK to tighten here; the row-flip below is a harmless
--     no-op kept only as a belt-and-braces guard. If a future schema ever loosens
--     this CHECK, this migration still normalizes any stray 'hybrid' rows.
--
-- (B) Add profiles.active_broker_account_id pointer.
-- (C) General backfill of trades.broker_account_id (bypasses the 0047 immutability
--     trigger via session_replication_role = replica), plus demo trust_badge for EA
--     trades on demo-typed accounts. Anything left NULL is genuinely ambiguous and
--     is handled by the Phase 2 "Unassigned" bucket — we do not guess.

begin;

-- (A) Remove hybrid mode: flip any existing rows to manual (no-op given the
--     0020 CHECK, but safe and idempotent).
update broker_accounts set journal_mode = 'manual' where journal_mode = 'hybrid';

-- (B) Active-account pointer on profiles.
alter table profiles
  add column if not exists active_broker_account_id uuid
  references broker_accounts(id) on delete set null;

-- (C) General backfill (bypass the 0047 immutability trigger).
set local session_replication_role = replica;

-- C1: EA trades -> the owning user's EA-token-linked account, when unambiguous.
with ea_target as (
  select user_id, (array_agg(distinct broker_account_id))[1] as account_id
  from ea_tokens
  where broker_account_id is not null
  group by user_id
  having count(distinct broker_account_id) = 1
)
update trades tr set broker_account_id = et.account_id
from ea_target et
where tr.capture_source = 'ea' and tr.broker_account_id is null and tr.user_id = et.user_id;

-- C2: Manual trades -> the user's single manual-mode account, when unambiguous.
with man_acct as (
  select user_id, (array_agg(id))[1] as account_id
  from broker_accounts where journal_mode = 'manual'
  group by user_id having count(*) = 1
)
update trades tr set broker_account_id = ma.account_id
from man_acct ma
where tr.capture_source is distinct from 'ea' and tr.broker_account_id is null and tr.user_id = ma.user_id;

-- C3: Remaining manual trades -> the user's only account, when they have exactly one.
with sole_acct as (
  select user_id, (array_agg(id))[1] as account_id
  from broker_accounts group by user_id having count(*) = 1
)
update trades tr set broker_account_id = sa.account_id
from sole_acct sa
where tr.capture_source is distinct from 'ea' and tr.broker_account_id is null and tr.user_id = sa.user_id;

-- C4: Demo badge for EA trades whose account is typed demo.
update trades tr set trust_badge = 'demo'
from broker_accounts ba
where tr.broker_account_id = ba.id and tr.capture_source = 'ea'
  and ba.account_type = 'demo' and tr.trust_badge is distinct from 'demo';

set local session_replication_role = origin;
commit;

-- Anything still NULL is genuinely ambiguous (multi-account user, no single manual
-- account) -> handled by the Phase 2 "Unassigned" bucket. Do not guess here.
