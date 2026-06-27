import type { MetadataRoute } from "next";

const BASE = "https://journal.bigmarkt.co";

// Static, indexable routes. /login and /signup are intentionally excluded
// (noindex auth pages with nothing to rank).
const STATIC: MetadataRoute.Sitemap = [
  { url: `${BASE}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
  { url: `${BASE}/leaderboard`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  { url: `${BASE}/feed`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  { url: `${BASE}/brokers`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch public ranked profiles via the SECURITY DEFINER RPC (anon-accessible).
  // Only ranked profiles (score_tier != 'none') with a username are included —
  // these are the profiles most likely to receive organic search traffic.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  let profileEntries: MetadataRoute.Sitemap = [];

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_leaderboard_scores`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_tier: "all", p_limit: 500 }),
        next: { revalidate: 3600 },
      });

      if (res.ok) {
        const rows = (await res.json()) as Array<{
          username: string | null;
          last_scored_at: string | null;
        }>;
        const seen = new Set<string>();
        for (const r of rows) {
          if (!r.username || seen.has(r.username)) continue;
          seen.add(r.username);
          profileEntries.push({
            url: `${BASE}/@${r.username}`,
            lastModified: r.last_scored_at ? new Date(r.last_scored_at) : new Date(),
            changeFrequency: "daily",
            priority: 0.8,
          });
        }
      }
    } catch {
      // Sitemap degrades gracefully if the fetch fails — static URLs still served.
    }
  }

  return [...STATIC, ...profileEntries];
}
