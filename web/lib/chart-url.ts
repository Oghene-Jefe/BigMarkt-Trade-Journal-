// Same-origin chart proxy URL. Resolves to journal.bigmarkt.co/c/<id> in prod,
// keeping the raw Supabase storage URL (and project ref) off the wire.
//
// The proxy URL is STABLE per trade id, so without a cache-buster the browser/
// CDN keeps serving the old image after a chart replace (Cache-Control sets
// max-age on /c/<id>). We append ?v=<ts> derived from the chart_path — paths
// look like `<user>/<trade>/chart-<Date.now()>.<ext>` — so a replace (new
// timestamp) yields a new URL and dodges the stale cache. The route keys off
// the path id only and ignores the query param.
export function chartProxyUrl(tradeId: string, chartPath?: string | null): string {
  const base = `/c/${tradeId}`;
  if (!chartPath) return base;
  const m = chartPath.match(/chart-(\d+)\./);
  return m ? `${base}?v=${m[1]}` : base;
}
