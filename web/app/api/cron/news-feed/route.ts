import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchAllFeeds, normalize } from "@/lib/news/forexFactory";

// Vercel cron — runs daily at 00:00 UTC.
// Fetches this week's and next week's Forex Factory economic calendar and
// upserts into the news_events table. Protected by CRON_SECRET — Vercel
// sets the "Authorization: Bearer ${CRON_SECRET}" header automatically on
// cron invocations.
//
// All parsing/normalization logic lives in @/lib/news/forexFactory so this
// route stays focused on the request/response + DB write.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Misconfigured deploy: never let an unset secret degrade into accepting
  // `Authorization: Bearer undefined`. Template-literally that's a real,
  // matchable string — so prior code accepted any caller who supplied it.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set — refusing to run cron");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { raw, failures } = await fetchAllFeeds();
  for (const f of failures) {
    console.error("News feed fetch error:", f);
  }

  if (raw.length === 0) {
    return NextResponse.json({ error: "All feeds failed to fetch" }, { status: 502 });
  }

  const nowIso = new Date().toISOString();
  const rows = raw
    .map((e) => normalize(e, nowIso))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    console.warn("News feed cron: no valid rows after parsing");
    return NextResponse.json({ upserted: 0, parsed: raw.length });
  }

  const sb = supabaseAdmin();

  // Upsert on (event_time, title) — updates forecast/previous/actual as they
  // are populated by Forex Factory after the event occurs.
  const { error } = await sb
    .from("news_events")
    .upsert(rows, { onConflict: "event_time,title" });

  if (error) {
    console.error("News feed upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`News feed cron: upserted ${rows.length} events from ${raw.length} parsed`);
  return NextResponse.json({ upserted: rows.length, parsed: raw.length });
}
