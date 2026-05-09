-- =============================================================================
-- 0005_consolidate_visibility.sql
-- The existing prod schema had `trades.trade_visibility` (text, values:
-- 'public' | 'followers_only' | other). 0001 added a parallel `visibility`
-- column that 0002/0003 reference. Backfill `visibility` from the legacy
-- column so existing data isn't silently downgraded to 'private'.
--
-- Per REBUILD_BRIEF: 'followers_only' has no follower system to back it,
-- so it's treated as 'private' until that feature lands.
-- =============================================================================

update public.trades
set visibility = case
  when trade_visibility = 'public' then 'public'
  when trade_visibility = 'exclude' then 'exclude'
  else 'private'
end
where (trade_visibility is not null)
  and (visibility = 'private' or visibility is null);

-- We do NOT drop trade_visibility yet — the old static app at the repo root
-- still references it. Drop in a later migration after old app retirement.
