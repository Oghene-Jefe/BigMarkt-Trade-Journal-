-- =============================================================================
-- 0039_news_events_url.sql
--
-- Adds a `url` column to news_events. The Forex Factory XML feed includes
-- a <url> field per event linking to the official calendar permalink for
-- that release. Earlier parser code discarded that field, and the UI fell
-- back to a Google News search — useful but indirect. With url stored
-- per-row, the journal NEWS tab can link straight to the source.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, no constraint flips.
-- =============================================================================

ALTER TABLE public.news_events
  ADD COLUMN IF NOT EXISTS url text;
