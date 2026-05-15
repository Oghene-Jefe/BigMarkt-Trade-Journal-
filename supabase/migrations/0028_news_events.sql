-- 0028_news_events.sql
-- Creates news_events table for economic calendar data (Forex Factory feed).
-- The table was previously referenced in application code but never formally
-- migrated. This migration is idempotent: safe to run against a DB where the
-- table already exists. The unique constraint on (event_time, title) is
-- required for the daily news-feed cron upsert.

CREATE TABLE IF NOT EXISTS public.news_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  currency    text,
  impact      text        CHECK (impact IN ('low', 'medium', 'high')),
  event_time  timestamptz NOT NULL,
  forecast    text,
  previous    text,
  actual      text,
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint used as the ON CONFLICT target for cron upserts.
-- event_time + title uniquely identifies a real-world calendar event.
DO $$ BEGIN
  ALTER TABLE public.news_events
    ADD CONSTRAINT news_events_event_time_title_key UNIQUE (event_time, title);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index for the 7-day window query in the journal NEWS tab.
CREATE INDEX IF NOT EXISTS news_events_event_time_idx
  ON public.news_events (event_time DESC);

-- RLS: all authenticated users can read; only the service role can write
-- (inserts come from the cron which uses the admin/service-role client).
ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "news_events_select_authenticated"
    ON public.news_events
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
