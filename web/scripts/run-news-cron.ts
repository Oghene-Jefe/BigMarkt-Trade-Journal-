// One-shot runner that mirrors the Vercel cron at
// web/app/api/cron/news-feed/route.ts but bypasses the CRON_SECRET gate
// by writing directly with the service-role key from .env.local.
//
// Usage:  npm run news:run        (from web/)
//   or:   npx tsx scripts/run-news-cron.mts
//
// Parsing/normalization is shared with the cron route via
// @/lib/news/forexFactory so behaviour stays in sync.

import { config as dotenvConfig } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { fetchAllFeeds, normalize } from "../lib/news/forexFactory";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const { raw, failures } = await fetchAllFeeds();
  for (const f of failures) console.error("Fetch failed:", f);

  if (raw.length === 0) {
    console.error("No events parsed; aborting");
    process.exit(2);
  }

  const nowIso = new Date().toISOString();
  const rows = raw
    .map((e) => normalize(e, nowIso))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb
    .from("news_events")
    .upsert(rows, { onConflict: "event_time,title" });

  if (error) {
    console.error("Upsert error:", error);
    process.exit(3);
  }

  console.log(`OK: upserted ${rows.length} events (parsed ${raw.length})`);
}

main();
