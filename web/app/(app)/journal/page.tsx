import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { signCharts } from "@/lib/storage";
import JournalClient from "./JournalClient";
import NewsFeed from "./NewsFeed";
import type { TradeRow, NewsEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

type View = "all" | "my_trades" | "signals" | "news";

function parseView(v: string | string[] | undefined): View {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "my_trades" || s === "signals" || s === "news") return s;
  return "all";
}

const TABS: { key: View; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "my_trades", label: "MY TRADES" },
  { key: "signals", label: "SIGNALS" },
  { key: "news", label: "NEWS" },
];

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const sp = await searchParams;
  const view = parseView(sp.view);

  const sb = await supabaseServer();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl tracking-widest text-gold">JOURNAL</h1>
        {/*
          "Imports" button intentionally hidden alongside the Bybit
          exchange feature (see DrawerNav comment). /journal/imports
          still works via direct URL. See INFRASTRUCTURE.md → Hidden
          features.
        */}
        <Link
          href="/journal/new"
          className="rounded-md bg-gold px-5 py-2 font-display tracking-widest text-black"
        >
          NEW TRADE
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === view;
          return (
            <Link
              key={t.key}
              href={`/journal?view=${t.key}`}
              className={`rounded-full px-4 py-1.5 font-display text-xs tracking-widest transition ${
                active
                  ? "bg-gold text-black"
                  : "border border-white/10 bg-panel text-muted hover:text-white"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {view === "news" ? (
        <NewsView sb={sb} />
      ) : (
        <TradesView sb={sb} view={view} />
      )}
    </div>
  );
}

async function TradesView({
  sb,
  view,
}: {
  sb: Awaited<ReturnType<typeof supabaseServer>>;
  view: Exclude<View, "news">;
}) {
  let query = sb.from("trades").select("*");
  if (view === "my_trades") {
    query = query.neq("capture_source", "signal");
  } else if (view === "signals") {
    query = query.eq("capture_source", "signal");
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  const trades = (data ?? []) as TradeRow[];
  const paths = trades.map((t) => t.chart_path).filter((p): p is string => !!p);
  const chartUrls = await signCharts(paths);

  if (error) {
    return (
      <div className="rounded-2xl border border-loss/30 bg-loss/10 p-8 text-center">
        <p className="font-display text-lg tracking-widest text-loss">FAILED TO LOAD</p>
        <p className="mt-2 text-sm text-muted">Failed to load trades. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {view === "signals" ? (
        <p className="rounded-xl border border-white/10 bg-panel p-3 text-xs text-muted">
          Signals received from leaders you follow. These trades are excluded
          from your performance score.
        </p>
      ) : null}
      <JournalClient trades={trades} chartUrls={chartUrls} />
    </div>
  );
}

// Returns [startOfWeekMonday, startOfNextMonday) in UTC as ISO strings.
// We anchor on Monday because Forex Factory's "thisweek" feed is Mon→Sun.
function currentWeekWindow(): { start: string; end: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const offsetToMonday = (day + 6) % 7; // Mon→0, Tue→1, ..., Sun→6
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - offsetToMonday,
    0, 0, 0, 0,
  ));
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function NewsView({
  sb,
}: {
  sb: Awaited<ReturnType<typeof supabaseServer>>;
}) {
  const { start, end } = currentWeekWindow();

  const { data, error } = await sb
    .from("news_events")
    .select("*")
    .gte("event_time", start)
    .lt("event_time", end)
    .order("event_time", { ascending: true });

  if (error) {
    return (
      <div className="rounded-2xl border border-loss/30 bg-loss/10 p-8 text-center space-y-3">
        <p className="text-sm text-muted">Could not load news. Try again later.</p>
        <a
          href="/journal?view=news"
          className="inline-block rounded-md border border-white/10 bg-panel px-5 py-2 font-display text-xs tracking-widest text-gold hover:bg-white/5"
        >
          RETRY
        </a>
      </div>
    );
  }

  return (
    <NewsFeed
      initial={(data ?? []) as NewsEvent[]}
      windowStart={start}
      windowEnd={end}
    />
  );
}
