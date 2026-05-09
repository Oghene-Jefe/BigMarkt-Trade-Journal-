-- =============================================================================
-- 0006_chart_path.sql
-- New `chart_path` column stores the storage object key (e.g.
-- "<user_id>/<trade_id>/chart-1234.jpg"). Display URLs are minted server-side
-- as signed URLs with short TTL — no permanent public links.
--
-- Legacy `image_url` is preserved (read-only) for the static app. Two shapes
-- exist there: (a) storage public URLs, (b) inline base64 data URLs from a
-- pre-storage era. Backfill handles (a). The base64 ones stay where they
-- are; the new app simply won't render them. A future cleanup can re-upload.
-- =============================================================================

alter table public.trades add column if not exists chart_path text;

update public.trades
set chart_path = regexp_replace(
  image_url,
  '^https?://[^/]+/storage/v1/object/public/trade-charts/',
  ''
)
where image_url is not null
  and image_url ~ '^https?://[^/]+/storage/v1/object/public/trade-charts/'
  and chart_path is null;

create index if not exists trades_chart_path_idx on public.trades(chart_path) where chart_path is not null;
