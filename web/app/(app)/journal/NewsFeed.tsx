"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { NewsEvent } from "@/lib/types";

type Props = {
  initial: NewsEvent[];
  windowStart: string;
  windowEnd: string;
};

const POLL_MS = 60_000;

export default function NewsFeed({ initial, windowStart, windowEnd }: Props) {
  const [events, setEvents] = useState<NewsEvent[]>(initial);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return (
      <div className="rounded-lg border border-loss/30 bg-loss/10 p-8 text-center space-y-3">
        <p className="text-sm text-muted">Could not load news. Try again later.</p>
        <button
          type="button"
          onClick={fetchEvents}
          className="inline-block rounded-md border border-white/10 bg-panel px-5 py-2 text-xs font-medium text-gold hover:bg-white/5"
        >
          RETRY
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

  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="rounded-xl border border-white/10 bg-panel p-4">
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
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
