// Shared Forex Factory feed parsing + normalization.
//
// Consumed by:
//   - web/app/api/cron/news-feed/route.ts   (Vercel daily cron)
//   - web/scripts/run-news-cron.mts         (one-shot local backfill)
//
// Keep this file dependency-free (no Supabase / Next imports) so it can run
// in any TS context including the unit tests under __tests__/.

export type ForexFactoryFeedUrl = string;

export const FEEDS: ForexFactoryFeedUrl[] = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.xml",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.xml",
];

// Forex Factory's XML uses country names; map them to ISO currency codes.
// Both forms appear in the wild — three-letter codes for cleaned-up entries
// and full country names for older / less-formalized ones.
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
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

export type RawEvent = {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
};

export type NormalizedEvent = {
  title: string;
  currency: string | null;
  impact: "low" | "medium" | "high" | null;
  event_time: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  source: "forex_factory";
  updated_at: string;
};

// ── XML parsing ─────────────────────────────────────────────────────────────

const CDATA_RE = /^<!\[CDATA\[([\s\S]*?)\]\]>$/;

export function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Returns the tag's text content, with CDATA stripped. Treats self-closing
// tags (<forecast />, <forecast/>) and missing tags as empty strings —
// both forms appear in the live feed for unannounced numbers.
export function extractTag(block: string, tag: string): string {
  // Self-closing: <tag/> or <tag /> → empty
  const selfClosing = block.match(new RegExp(`<${tag}\\s*/>`));
  if (selfClosing) return "";
  // Paired tags
  const paired = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!paired) return "";
  const raw = paired[1].trim();
  const cdata = raw.match(CDATA_RE);
  return decodeXml(cdata ? cdata[1] : raw);
}

export function parseXml(xml: string): RawEvent[] {
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

// ── Date / time parsing ─────────────────────────────────────────────────────

// Compute the last Sunday of a given month at a given UTC clock time.
// monthIndex: 0–11 (Jan = 0). Used for the BST start/end transition dates.
function lastSundayOfMonthUtc(
  year: number,
  monthIndex: number,
  hour: number,
  min: number,
): Date {
  // Day 0 of next month = last day of `monthIndex`.
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const sundayDate = lastDay.getUTCDate() - lastDay.getUTCDay();
  return new Date(Date.UTC(year, monthIndex, sundayDate, hour, min));
}

// Europe/London's UTC offset in minutes at the given instant. Returns 60
// during BST (last Sun of March 01:00 UTC → last Sun of Oct 01:00 UTC),
// else 0 (GMT).
export function londonUtcOffsetMinutes(d: Date): number {
  const year = d.getUTCFullYear();
  const bstStart = lastSundayOfMonthUtc(year, 2, 1, 0);
  const bstEnd = lastSundayOfMonthUtc(year, 9, 1, 0);
  return d >= bstStart && d < bstEnd ? 60 : 0;
}

// Parse a Forex Factory date+time pair.
//
// Feed currently uses:
//   date: "MM-DD-YYYY"           e.g. "05-11-2026"
//   time: "h:mmam" | "h:mmpm"    e.g. "1:30am", "12:00pm", "Tentative", "All Day", ""
//
// Returns the ISO UTC string for the event instant, treating wall-clock
// times as Europe/London and converting via londonUtcOffsetMinutes.
// "Tentative" / "All Day" / missing time fall back to 00:00 London for
// the date — sorts correctly, and the UI surfaces the time string
// separately.
//
// Returns null if the date can't be parsed.
export function parseFfDateTime(date: string, time: string): string | null {
  const dm = date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!dm) return null;
  const month = parseInt(dm[1], 10) - 1;
  const day = parseInt(dm[2], 10);
  const year = parseInt(dm[3], 10);
  if (
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(year) ||
    month < 0 || month > 11 ||
    day < 1 || day > 31
  ) {
    return null;
  }

  let hours = 0;
  let mins = 0;
  const tm = time.replace(/\s+/g, "").match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (tm) {
    hours = parseInt(tm[1], 10);
    mins = parseInt(tm[2], 10);
    if (tm[3].toLowerCase() === "pm" && hours !== 12) hours += 12;
    if (tm[3].toLowerCase() === "am" && hours === 12) hours = 0;
  }

  // Step 1: treat year/month/day/hours/mins as if it were UTC. This gives a
  // candidate instant; we then look up what London's offset is at that
  // instant and subtract to get the true UTC instant.
  const candidateMs = Date.UTC(year, month, day, hours, mins);
  const offsetMin = londonUtcOffsetMinutes(new Date(candidateMs));
  return new Date(candidateMs - offsetMin * 60_000).toISOString();
}

export function toImpact(raw: string): "low" | "medium" | "high" | null {
  switch (raw.toLowerCase()) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return null;
  }
}

// ── Row normalization ───────────────────────────────────────────────────────

// Map RawEvent → DB-shaped row. Returns null for unusable rows (missing
// title or unparseable date), which the caller filters out.
export function normalize(
  e: RawEvent,
  nowIso: string,
): NormalizedEvent | null {
  const event_time = parseFfDateTime(e.date, e.time);
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
    updated_at: nowIso,
  };
}

// ── Fetch + parse helper ────────────────────────────────────────────────────

// Fetches all FEEDS in parallel, tolerating per-feed failure. Returns the
// concatenated RawEvent list plus the per-feed error list for logging.
export async function fetchAllFeeds(): Promise<{
  raw: RawEvent[];
  failures: string[];
}> {
  const results = await Promise.allSettled(
    FEEDS.map((url) =>
      fetch(url, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
        return r.text();
      }),
    ),
  );
  const raw: RawEvent[] = [];
  const failures: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") raw.push(...parseXml(r.value));
    else failures.push(String(r.reason));
  }
  return { raw, failures };
}
