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

// Forex Factory doesn't expose a per-event permalink in its XML feed, and
// Google News gives the most reliable surface for "what happened with this
// release" coverage. We compose a search URL from the event's currency +
// title; opens in a new tab.
function storyLink(e: NewsEvent): string {
  const parts: string[] = [];
  if (e.currency) parts.push(e.currency);
  parts.push(e.title);
  const q = encodeURIComponent(parts.join(" "));
  return `https://news.google.com/search?q=${q}`;
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
  // Clamp page if the underlying list shrinks below the current page.
  const safePage = Math.min(page, totalPages - 1);
  const pageEvents = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return events.slice(start, start + PAGE_SIZE);
  }, [events, safePage]);

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
        <p className="text-sm text-muted">No news events this week</p>
      </div>
    );
  }

  const firstShown = safePage * PAGE_SIZE + 1;
  const lastShown = Math.min(firstShown + pageEvents.length - 1, events.length);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {pageEvents.map((e) => (
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
              <span>{fmtEventTime(e.event_time)}</span>
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

function fmtEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
