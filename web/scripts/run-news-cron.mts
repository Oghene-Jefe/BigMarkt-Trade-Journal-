// One-shot runner that mirrors the logic at web/app/api/cron/news-feed/route.ts.
// Populates news_events without needing a Vercel UI click or the CRON_SECRET.
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from web/.env.local.

import { config as dotenvConfig } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

const FEEDS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.xml",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.xml",
];

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  USD: "USD", EUR: "EUR", GBP: "GBP", JPY: "JPY",
  AUD: "AUD", CAD: "CAD", CHF: "CHF", NZD: "NZD",
  CNY: "CNY", HKD: "HKD", SGD: "SGD", KRW: "KRW",
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
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  const raw = m[1].trim();
  const cdata = raw.match(CDATA_RE);
  return decodeXml(cdata ? cdata[1] : raw);
}

function parseXml(xml: string): RawEvent[] {
  const events: RawEvent[] = [];
  const matches = xml.matchAll(/<event>([\s\S]*?)<\/event>/g);
  for (const m of matches) {
    const b = m[1];
    events.push({
      title: extractTag(b, "title"),
      country: extractTag(b, "country"),
      date: extractTag(b, "date"),
      time: extractTag(b, "time"),
      impact: extractTag(b, "impact"),
      forecast: extractTag(b, "forecast"),
      previous: extractTag(b, "previous"),
      actual: extractTag(b, "actual"),
    });
  }
  return events;
}

function toEventTime(date: string, time: string): string | null {
  if (!date) return null;
  let hours = 0;
  let mins = 0;
  const tMatch = time.replace(/\s+/g, "").match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
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
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
    default: return null;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const results = await Promise.allSettled(
    FEEDS.map((u) =>
      fetch(u, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} from ${u}`);
        return r.text();
      }),
    ),
  );

  const rawEvents: RawEvent[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") rawEvents.push(...parseXml(r.value));
    else console.error("Fetch failed:", r.reason);
  }

  if (rawEvents.length === 0) {
    console.error("No events parsed; aborting");
    process.exit(2);
  }

  const now = new Date().toISOString();
  const rows = rawEvents
    .map((e) => {
      const event_time = toEventTime(e.date, e.time);
      if (!event_time || !e.title) return null;
      return {
        title: e.title,
        currency: COUNTRY_TO_CURRENCY[e.country] ?? null,
        impact: toImpact(e.impact),
        event_time,
        forecast: e.forecast || null,
        previous: e.previous || null,
        actual: e.actual || null,
        source: "forex_factory",
        updated_at: now,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb
    .from("news_events")
    .upsert(rows, { onConflict: "event_time,title" });

  if (error) {
    console.error("Upsert error:", error);
    process.exit(3);
  }

  console.log(`OK: upserted ${rows.length} events (parsed ${rawEvents.length})`);
}

main();
