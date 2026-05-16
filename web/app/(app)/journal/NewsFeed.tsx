"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { NewsEvent } from "@/lib/types";

type Props = {
  initial: NewsEvent[];
  windowStart: string;
  windowEnd: string;
};

const POLL_MS = 60_000;
const PAGE_SIZE = 20;

// Prefer the canonical Forex Factory permalink stored on the row (added in
// migration 0039 and populated by the shared parser). Older rows imported
// before url ingestion shipped don't have one — fall back to a Google
// News search composed from the event's currency + title.
function storyLink(e: NewsEvent): string {
  if (e.url && /^https?:\/\//i.test(e.url)) return e.url;
  const parts: string[] = [];
  if (e.currency) parts.push(e.currency);
  parts.push(e.title);
  const q = encodeURIComponent(parts.join(" "));
  return `https://news.google.com/search?q=${q}`;
}

// Day key in the viewer's local timezone — "Mon, May 11" style. Used to
// group events under per-day headers so a 14-day window doesn't read as a
// 200-row wall.
function dayKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function NewsFeed({ initial, windowStart, windowEnd }: Props) {
  const [events, setEvents] = useState<NewsEvent[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const fetchEvents = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from("news_events")
      .select("*")
      .gte("event_time", windowStart)
      .lt("event_time", windowEnd)
      .order("event_time", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setEvents((data ?? []) as NewsEvent[]);
  }, [windowStart, windowEnd]);

  useEffect(() => {
    const id = setInterval(fetchEvents, POLL_MS);
    return () => clearInterval(id);
  }, [fetchEvents]);

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  // Slice the active page first, then bucket by local-date so per-day
  // headers appear inside the page. Within each day, order is preserved
  // because the upstream query is ascending by event_time.
  const pageEvents = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return events.slice(start, start + PAGE_SIZE);
  }, [events, safePage]);

  const grouped = useMemo(() => {
    const buckets: { day: string; rows: NewsEvent[] }[] = [];
    for (const e of pageEvents) {
      const day = dayKey(e.event_time);
      const last = buckets[buckets.length - 1];
      if (last && last.day === day) last.rows.push(e);
      else buckets.push({ day, rows: [e] });
    }
    return buckets;
  }, [pageEvents]);

  if (error) {
    return (
      <div className="rounded-lg border border-loss/30 bg-loss/10 p-8 text-center space-y-3">
        <p className="text-sm text-muted">Could not load news. Try again later.</p>
        <button
          type="button"
          onClick={fetchEvents}
          className="inline-block rounded-md border border-white/10 bg-panel px-5 py-2 text-xs font-medium text-gold hover:bg-white/5"
        >
          Retry
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-panel p-8 text-center">
        <p className="text-sm text-muted">No news events in the next two weeks</p>
      </div>
    );
  }

  const firstShown = safePage * PAGE_SIZE + 1;
  const lastShown = Math.min(firstShown + pageEvents.length - 1, events.length);

  return (
    <div className="space-y-4">
      {grouped.map((bucket) => (
        <section key={bucket.day} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {bucket.day}
          </h3>
          <ul className="space-y-2">
            {bucket.rows.map((e) => (
              <li key={e.id} className="rounded-lg border border-white/10 bg-panel p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={storyLink(e)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-1 items-center gap-2 font-semibold text-white hover:text-gold"
                  >
                    <span>{e.title}</span>
                    <ExternalLink
                      size={12}
                      aria-hidden
                      className="text-muted group-hover:text-gold"
                    />
                  </a>
                  <ImpactPill impact={e.impact} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{timeOnly(e.event_time)}</span>
                  {e.currency
                    ? e.currency
                        .split(",")
                        .map((c) => c.trim())
                        .filter(Boolean)
                        .map((c) => (
                          <span
                            key={c}
                            className="rounded border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white"
                          >
                            {c}
                          </span>
                        ))
                    : null}
                  <a
                    href={storyLink(e)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-gold hover:underline"
                  >
                    <span>Read story</span>
                    <ExternalLink size={12} aria-hidden />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Showing {firstShown}–{lastShown} of {events.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="inline-flex items-center gap-1 rounded-md border border-white/15 px-3 py-1 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={14} aria-hidden />
            <span>Prev</span>
          </button>
          <span className="tabular-nums">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="inline-flex items-center gap-1 rounded-md border border-white/15 px-3 py-1 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <span>Next</span>
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
      </div>
    </div>
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
      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}
    >
      {impact ?? "—"}
    </span>
  );
}
