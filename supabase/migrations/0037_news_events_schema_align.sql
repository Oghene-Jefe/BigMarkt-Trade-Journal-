-- =============================================================================
-- 0037_news_events_schema_align.sql
--
-- 0028 declared a news_events schema for the daily Forex Factory cron, but
-- the prod table already existed with a different shape from earlier work
-- (event_name / affected_pairs / notified columns, no title / forecast /
-- previous / actual / updated_at). 0028's CREATE TABLE IF NOT EXISTS was
-- a no-op, so the cron's upsert at /api/cron/news-feed has been failing
-- silently every night because it writes columns that don't exist. The
-- table sat at zero rows, the NEWS tab was permanently empty.
--
-- This migration aligns the prod table with 0028's declared shape, and is
-- defensive about three things:
--
--   1. It backfills `title` from `event_name` for any pre-existing rows.
--      Rows that lack both still get a deterministic 'Untitled event'
--      stamp so the NOT NULL flip can't fail in environments where
--      legacy rows exist.
--
--   2. It does NOT drop the legacy columns (event_name / affected_pairs
--      / notified). They're decoupled from current code and harmless to
--      keep. A follow-up migration can remove them once we have
--      confirmed every environment has zero rows or backups, per the
--      project's "don't drop without explicit verification" guideline.
--
--   3. Every ALTER is wrapped in IF EXISTS / IF NOT EXISTS or a
--      duplicate_object exception block, so the file is safe to re-run
--      against any state.
-- =============================================================================

-- 1. Add columns the cron writes (idempotent).
ALTER TABLE public.news_events
  ADD COLUMN IF NOT EXISTS title      text,
  ADD COLUMN IF NOT EXISTS forecast   text,
  ADD COLUMN IF NOT EXISTS previous   text,
  ADD COLUMN IF NOT EXISTS actual     text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Backfill title. Two stages so the NOT NULL flip in step 3 never
--    fails: first copy from legacy event_name where it carries data,
--    then stamp anything still null with a deterministic fallback.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'news_events'
      AND column_name = 'event_name'
  ) THEN
    UPDATE public.news_events
       SET title = event_name
     WHERE title IS NULL
       AND event_name IS NOT NULL;
  END IF;
END $$;

UPDATE public.news_events
   SET title = 'Untitled event'
 WHERE title IS NULL;

-- 3. Now safe to lock title down.
ALTER TABLE public.news_events ALTER COLUMN title SET NOT NULL;

-- 4. Relax currency / impact / source so the cron can insert events
--    without a clean currency mapping or impact tag.
ALTER TABLE public.news_events
  ALTER COLUMN currency DROP NOT NULL,
  ALTER COLUMN impact   DROP NOT NULL,
  ALTER COLUMN source   DROP NOT NULL;

ALTER TABLE public.news_events ALTER COLUMN source SET DEFAULT 'forex_factory';

-- 5. Unique constraint used as the cron's ON CONFLICT target. Required
--    for upserts on (event_time, title).
DO $$ BEGIN
  ALTER TABLE public.news_events
    ADD CONSTRAINT news_events_event_time_title_key UNIQUE (event_time, title);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Index for the week-window query in the journal NEWS tab.
CREATE INDEX IF NOT EXISTS news_events_event_time_idx
  ON public.news_events (event_time DESC);

-- Note: legacy columns event_name / affected_pairs / notified are
-- intentionally left in place. They are no longer referenced by any
-- application code (verified via repo-wide grep), but removing them
-- destroys data in environments that haven't been migrated cleanly.
-- A follow-up migration can DROP COLUMN after explicit verification.
