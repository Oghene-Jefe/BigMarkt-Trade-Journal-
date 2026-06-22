-- 0067_idempotent_ingest.sql
-- Make EA ingest idempotent on re-send / startup backfill.
--
-- The EA replays closed deals, order events, and position_modify events on
-- startup, so the same logical event can arrive more than once. The trades
-- rows themselves are already deduped by the ingest route (manual
-- select-then-upsert plus the existing partial unique index
-- idx_trades_user_position_unique on (user_id, position_id)). The remaining
-- un-deduped, append-only path is public.trade_events (logEvent did a plain
-- INSERT), which would duplicate timeline entries on every replay.
--
-- This migration adds ONE unique index that covers all three event classes
-- the task calls out, using the columns that actually exist on trade_events:
--   • deals          → (user_id, event_type, position_id)         [filled / closed]
--   • position_modify→ (user_id, position_id, event_time)         [sl_tp_modified]
--   • order events   → (user_id, order_ticket, event_type)        [pending_*]
-- The single composite (user_id, event_type, position_id, order_ticket,
-- event_time) is a superset of all three, so a repeated send collides and is
-- ignored (ON CONFLICT DO NOTHING), while genuinely distinct events (e.g. two
-- SL/TP modifies at different event_time, or successive partial closes) keep
-- their own rows. NULLS NOT DISTINCT makes the null legs (position_id/
-- order_ticket/event_time absent on a given class) dedupe correctly, and lets
-- the index serve as the single ON CONFLICT arbiter for supabase-js .upsert()
-- (partial unique indexes can't be used as PostgREST arbiters).
--
-- "account identifier" maps to user_id here: trade_events has no
-- broker_account_id column, and user_id is the per-account owner the ingest
-- route already scopes every event by.
--
-- Idempotent: dedupes any pre-existing duplicate rows first, then creates the
-- index IF NOT EXISTS. Safe to run more than once. Apply manually in the
-- Supabase SQL editor.

-- 1. Remove pre-existing duplicates (keep the earliest row per logical key) so
--    the unique index can be built. Null-safe grouping mirrors NULLS NOT
--    DISTINCT via COALESCE sentinels.
delete from public.trade_events t
using public.trade_events keep
where t.user_id = keep.user_id
  and t.event_type = keep.event_type
  and coalesce(t.position_id, '')  = coalesce(keep.position_id, '')
  and coalesce(t.order_ticket, '') = coalesce(keep.order_ticket, '')
  and coalesce(t.event_time, 'epoch'::timestamptz) = coalesce(keep.event_time, 'epoch'::timestamptz)
  and (
    t.created_at > keep.created_at
    or (t.created_at = keep.created_at and t.id > keep.id)
  );

-- 2. Idempotent uniqueness across the three event classes.
create unique index if not exists trade_events_idempotent_uidx
  on public.trade_events (user_id, event_type, position_id, order_ticket, event_time)
  nulls not distinct;
