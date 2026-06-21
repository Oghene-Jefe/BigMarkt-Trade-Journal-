import Link from "next/link";
import { Plus } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { signCharts } from "@/lib/storage";
import { getActiveAccount } from "@/lib/accounts";
import JournalClient from "./JournalClient";
import NewsFeed from "./NewsFeed";
import type { TradeRow, NewsEvent } from "@/lib/types";
import { PageHeader, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

type View = "all" | "my_trades" | "signals" | "news";

function parseView(v: string | string[] | undefined): View {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "my_trades" || s === "signals" || s === "news") return s;
  return "all";
}

const TABS: { key: View; label: string }[] = [
  { key: "all", label: "All" },
  { key: "my_trades", label: "My trades" },
  { key: "signals", label: "Following" },
  { key: "news", label: "News" },
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
      <PageHeader
        title="Journal"
        action={
          // "Imports" button hidden because the Bybit exchange feature
          // it depends on isn't part of the current rollout (see
          // DrawerNav comment). /journal/imports still works via
          // direct URL. See INFRASTRUCTURE.md → Hidden features.
          <LinkButton href="/journal/new" icon={<Plus size={14} aria-hidden />}>
            New trade
          </LinkButton>
        }
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === view;
          return (
            <Link
              key={t.key}
              href={`/journal?view=${t.key}`}
              className={`rounded-md px-3 py-1.5 text-xs transition ${
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
  const { data: { user } } = await sb.auth.getUser();
  const { activeId } = await getActiveAccount(sb, user!.id);

  let query = sb.from("trades").select("*");
  if (view === "my_trades") {
    query = query.neq("capture_source", "signal");
  } else if (view === "signals") {
    query = query.eq("capture_source", "signal");
  }
  // Scope the journal to the active account (single source of truth from the
  // global switcher in the shell).
  if (activeId) {
    query = query.eq("broker_account_id", activeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  const trades = (data ?? []) as TradeRow[];
  const paths = trades.map((t) => t.chart_path).filter((p): p is string => !!p);
  const chartUrls = await signCharts(paths);

  // Constitution deviation counts per trade — one query, grouped client-side.
  // RLS self-select scopes this to the current user's own violations.
  const violationCounts: Record<string, number> = {};
  const { data: vios } = await sb
    .from("constitution_violations")
    .select("trade_id, rule_key")
    .eq("user_id", user!.id);
  for (const v of (vios ?? []) as { trade_id: string }[]) {
    violationCounts[v.trade_id] = (violationCounts[v.trade_id] ?? 0) + 1;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-loss/30 bg-loss/10 p-8 text-center">
        <p className="text-base font-medium text-loss">Failed to load</p>
        <p className="mt-2 text-sm text-muted">Please refresh the page.</p>
      </div>
    );
  }

  // Signals fan-out is not yet built — capture_source = 'signal' is never
  // written, so this list will always be empty until fan-out ships.
  if (view === "signals" && trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-panel py-20 text-center">
        <p className="text-base font-semibold text-white">Follow verified traders and their trades appear here.</p>
        <p className="mt-3 max-w-sm text-sm text-muted">
          When you follow a trader, their verified trades show up in this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {view === "signals" && trades.length > 0 ? (
        <p className="rounded-md border border-white/10 bg-panel p-3 text-xs text-muted">
          Trades from traders you follow. These are excluded from your personal
          performance score.
        </p>
      ) : null}
      <JournalClient trades={trades} chartUrls={chartUrls} violationCounts={violationCounts} />
    </div>
  );
}

// Returns [startOfWeekMonday, startOfMondayAfterNext) in UTC as ISO strings.
// We anchor on Monday because Forex Factory's feeds are Mon→Sun, and we
// surface BOTH this week and next week because the cron imports both.
function currentTwoWeekWindow(): { start: string; end: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const offsetToMonday = (day + 6) % 7; // Mon→0, Tue→1, ..., Sun→6
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - offsetToMonday,
    0, 0, 0, 0,
  ));
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function NewsView({
  sb,
}: {
  sb: Awaited<ReturnType<typeof supabaseServer>>;
}) {
  const { start, end } = currentTwoWeekWindow();

  const { data, error } = await sb
    .from("news_events")
    .select("*")
    .gte("event_time", start)
    .lt("event_time", end)
    .order("event_time", { ascending: true });

  if (error) {
    return (
      <div className="rounded-lg border border-loss/30 bg-loss/10 p-8 text-center space-y-3">
        <p className="text-sm text-muted">Could not load news. Try again later.</p>
        <a
          href="/journal?view=news"
          className="inline-block rounded-md border border-white/10 bg-panel px-5 py-2 text-xs font-medium text-gold hover:bg-white/5"
        >
          Retry
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
