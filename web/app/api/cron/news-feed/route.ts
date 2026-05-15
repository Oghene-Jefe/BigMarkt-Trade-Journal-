import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Vercel cron — runs daily at 00:00 UTC.
// Fetches this week's and next week's Forex Factory economic calendar and
// upserts into the news_events table. Protected by CRON_SECRET — Vercel
// sets the "Authorization: Bearer ${CRON_SECRET}" header automatically on
// cron invocations.

export const dynamic = "force-dynamic";

const FEEDS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.xml",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.xml",
];

// Forex Factory XML uses country names; map them to ISO currency codes.
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // Already-code forms (FF sometimes uses these)
  USD: "USD", EUR: "EUR", GBP: "GBP", JPY: "JPY",
  AUD: "AUD", CAD: "CAD", CHF: "CHF", NZD: "NZD",
  CNY: "CNY", HKD: "HKD", SGD: "SGD", KRW: "KRW",
  // Full country/region names used in the FF XML
  "United States": "USD",
  "Euro Zone": "EUR",
  "United Kingdom": "GBP",
  Japan: "JPY",
  Australia: "AUD",
  Canada: "CAD",
  Switzerland: "CHF",
  "New Zealand": "NZD",
  China: "CNY",
  "Hong Kong": "HKD",
  Singapore: "SGD",
  "South Korea": "KRW",
};

type RawEvent = {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
};

// ── XML helpers ─────────────────────────────────────────────────────────────

const CDATA_RE = /^<!\[CDATA\[([\s\S]*?)\]\]>$/;

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function extractTag(block: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block);
  if (!m) return "";
  const raw = m[1].trim();
  const cdata = CDATA_RE.exec(raw);
  return decodeXml(cdata ? cdata[1] : raw);
}

function parseXml(xml: string): RawEvent[] {
  const events: RawEvent[] = [];
  const re = /<event>([\s\S]*?)<\/event>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    events.push({
      title:    extractTag(b, "title"),
      country:  extractTag(b, "country"),
      date:     extractTag(b, "date"),
      time:     extractTag(b, "time"),
      impact:   extractTag(b, "impact"),
      forecast: extractTag(b, "forecast"),
      previous: extractTag(b, "previous"),
      actual:   extractTag(b, "actual"),
    });
  }
  return events;
}

// ── Value mappers ────────────────────────────────────────────────────────────

// date: "Jan 15, 2025"  time: "8:30am" | "Tentative" | "All Day" | ""
// Stored as UTC. FF times are typically US Eastern but the feed has no TZ
// annotation; we store as-is (UTC label) to keep the logic simple.
function toEventTime(date: string, time: string): string | null {
  if (!date) return null;
  let hours = 0;
  let mins = 0;
  const tMatch = /^(\d{1,2}):(\d{2})(am|pm)$/i.exec(time.replace(/\s+/g, ""));
  if (tMatch) {
    hours = parseInt(tMatch[1], 10);
    mins = parseInt(tMatch[2], 10);
    if (tMatch[3].toLowerCase() === "pm" && hours !== 12) hours += 12;
    if (tMatch[3].toLowerCase() === "am" && hours === 12) hours = 0;
  }
  const d = new Date(
    `${date} ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00 UTC`,
  );
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toImpact(raw: string): "low" | "medium" | "high" | null {
  switch (raw.toLowerCase()) {
    case "high":   return "high";
    case "medium": return "medium";
    case "low":    return "low";
    default:       return null;
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch both calendar feeds in parallel; tolerate a single feed failure.
  const fetches = await Promise.allSettled(
    FEEDS.map((url) =>
      fetch(url, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
        return r.text();
      }),
    ),
  );

  const rawEvents: RawEvent[] = [];
  for (const result of fetches) {
    if (result.status === "fulfilled") {
      rawEvents.push(...parseXml(result.value));
    } else {
      console.error("News feed fetch error:", result.reason);
    }
  }

  if (rawEvents.length === 0) {
    return NextResponse.json({ error: "All feeds failed to fetch" }, { status: 502 });
  }

  const now = new Date().toISOString();

  const rows = rawEvents
    .map((e) => {
      const event_time = toEventTime(e.date, e.time);
      if (!event_time || !e.title) return null;
      return {
        title:      e.title,
        currency:   COUNTRY_TO_CURRENCY[e.country] ?? null,
        impact:     toImpact(e.impact),
        event_time,
        forecast:   e.forecast || null,
        previous:   e.previous || null,
        actual:     e.actual || null,
        source:     "forex_factory",
        updated_at: now,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    console.warn("News feed cron: no valid rows after parsing");
    return NextResponse.json({ upserted: 0, parsed: rawEvents.length });
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

  console.log(`News feed cron: upserted ${rows.length} events from ${rawEvents.length} parsed`);
  return NextResponse.json({ upserted: rows.length, parsed: rawEvents.length });
}
