import type { MetadataRoute } from "next";

const BASE = "https://journal.bigmarkt.co";

// Static, indexable routes. /login and /signup are intentionally excluded
// (they're noindex auth pages with nothing to rank).
//
// Public profile URLs (/@username) are NOT listed here: the profile pages
// look profiles up one slug/id at a time via Supabase RPCs, and there's no
// public "list all profiles" source we can query without server-only creds
// at build time. If a public listing RPC/view becomes available, map it to
// `${BASE}/@${row.username}` entries and append them below.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${BASE}/`, lastModified },
    { url: `${BASE}/privacy`, lastModified },
    { url: `${BASE}/leaderboard`, lastModified },
    { url: `${BASE}/brokers`, lastModified },
  ];
}
