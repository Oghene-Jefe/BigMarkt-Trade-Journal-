-- Align trades_result_check with the app-canonical result value "BE".
-- The application (Zod schema, manual trade action, EA ingest, UI) writes
-- 'BE' for breakeven; a previous constraint rebuild used 'BREAKEVEN',
-- causing 23514 check violations on any zero-profit close.

update public.trades set result = 'BE' where result = 'BREAKEVEN';

alter table public.trades drop constraint if exists trades_result_check;

alter table public.trades
  add constraint trades_result_check
  check (result = any (array['WIN'::text, 'LOSS'::text, 'BE'::text]));
