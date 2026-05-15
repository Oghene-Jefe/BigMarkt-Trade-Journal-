import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { signCharts } from "@/lib/storage";
import JournalTable from "@/components/JournalTable";
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
      <JournalTable trades={trades} chartUrls={chartUrls} />
    </div>
  );
}

async function NewsView({
  sb,
}: {
  sb: Awaited<ReturnType<typeof supabaseServer>>;
}) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("news_events")
    .select("*")
    .gte("event_time", since)
    .order("event_time", { ascending: false });

  const events = (data ?? []) as NewsEvent[];

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

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-panel p-8 text-center">
        <p className="text-sm text-muted">
          No high impact news events in the last 7 days
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li
          key={e.id}
          className="rounded-xl border border-white/10 bg-panel p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 font-semibold text-white">{e.title}</p>
            <ImpactPill impact={e.impact} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{fmtEventTime(e.event_time)}</span>
            {e.currency
              ? e.currency
                  .split(",")
                  .map((c) => c.trim())
                  .filter(Boolean)
                  .map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white"
                    >
                      {c}
                    </span>
                  ))
              : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ImpactPill({ impact }: { impact: NewsEvent["impact"] }) {
  const map: Record<NonNullable<NewsEvent["impact"]>, string> = {
    high: "bg-loss/20 text-loss border-loss/40",
    medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    low: "bg-white/10 text-muted border-white/10",
  };
  const cls = impact ? map[impact] : "bg-white/10 text-muted border-white/10";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}
    >
      {impact ?? "—"}
    </span>
  );
}

function fmtEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
