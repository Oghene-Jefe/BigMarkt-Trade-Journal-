-- =============================================================================
-- 0037_news_events_schema_align.sql
--
-- 0028 declared a news_events schema for the daily Forex Factory cron, but
-- the prod table already existed with a different shape from earlier work
-- (event_name / affected_pairs / notified columns, no title / forecast /
-- previous / actual / updated_at). 0028's CREATE TABLE IF NOT EXISTS was
-- a no-op, so the cron's upsert at /api/cron/news-feed has been failing
-- silently every night because it writes columns that don't exist. The
-- table sits at zero rows, the NEWS tab is permanently empty.
--
-- This migration aligns the prod table with 0028's declared shape:
--   - adds the columns the cron writes (title, forecast, previous, actual,
--     updated_at)
--   - backfills title from event_name (0 rows today, harmless if any)
--   - relaxes currency/impact/source to nullable so the cron can insert
--     events whose country isn't in the COUNTRY_TO_CURRENCY map
--   - adds the unique constraint (event_time, title) that the cron's
--     ON CONFLICT target depends on
--   - drops the legacy columns now that nothing references them
--
-- No data loss: news_events is empty in prod. After this, the next cron
-- run should populate the table.
-- =============================================================================

-- 1. Add columns the cron writes
ALTER TABLE public.news_events
  ADD COLUMN IF NOT EXISTS title      text,
  ADD COLUMN IF NOT EXISTS forecast   text,
  ADD COLUMN IF NOT EXISTS previous   text,
  ADD COLUMN IF NOT EXISTS actual     text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Backfill title from event_name where rows already carry one.
UPDATE public.news_events SET title = event_name WHERE title IS NULL AND event_name IS NOT NULL;

-- 3. Make title NOT NULL (matches 0028's intent).
ALTER TABLE public.news_events ALTER COLUMN title SET NOT NULL;

-- 4. Relax currency / impact / source so the cron can insert events
--    without a clean currency mapping or impact tag.
ALTER TABLE public.news_events
  ALTER COLUMN currency DROP NOT NULL,
  ALTER COLUMN impact   DROP NOT NULL,
  ALTER COLUMN source   DROP NOT NULL;

ALTER TABLE public.news_events ALTER COLUMN source SET DEFAULT 'forex_factory';

-- 5. Unique constraint used as the cron's ON CONFLICT target.
DO $$ BEGIN
  ALTER TABLE public.news_events
    ADD CONSTRAINT news_events_event_time_title_key UNIQUE (event_time, title);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Index for the 7-day window query in the journal NEWS tab.
CREATE INDEX IF NOT EXISTS news_events_event_time_idx
  ON public.news_events (event_time DESC);

-- 7. Drop legacy columns that no code references.
ALTER TABLE public.news_events
  DROP COLUMN IF EXISTS event_name,
  DROP COLUMN IF EXISTS affected_pairs,
  DROP COLUMN IF EXISTS notified;
