import Link from "next/link";
import type { Route } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatars } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import type { ScoreTier } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_TABS = ["all", "pro", "active"] as const;
type Tab = (typeof VALID_TABS)[number];

type LeaderboardScoreEntry = {
  user_id: string;
  display_name: string | null;
  avatar_path: string | null;
  username: string | null;
  broker_account_id: string;
  score_tier: ScoreTier;
  active_score: number | null;
  pro_score: number | null;
  trade_count: number | null;
  win_rate_pct: number | null;
  expectancy_pct: number | null;
  sortino_ratio: number | null;
  max_drawdown_pct: number | null;
  last_scored_at: string | null;
};

const TAB_LABELS: Record<Tab, string> = {
  all: "ALL LEADERS",
  pro: "PRO TRADERS",
  active: "ACTIVE TRADERS",
};

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  all: "All ranked leaders — PRO scores weighted 1.2×",
  pro: "Verified Pro leaders — Sortino, Expectancy, Drawdown + Duration",
  active: "Active leaders — Expectancy, Win Rate, Drawdown, Regularity",
};

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function rankAccent(rank: number): string {
  if (rank === 0) return "border-l-4 border-l-yellow-400";
  if (rank === 1) return "border-l-4 border-l-gray-300";
  if (rank === 2) return "border-l-4 border-l-amber-700";
  return "border-l border-l-white/10";
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = VALID_TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "all";

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("get_leaderboard_scores", {
    p_tier: tab,
    p_limit: 50,
  });
  const rows = (data ?? []) as LeaderboardScoreEntry[];
  const paths = rows.map((r) => r.avatar_path).filter((p): p is string => !!p);
  const avatars = await signAvatars(paths);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-widest text-gold">LEADERBOARD</h1>
      </div>

      <div className="flex gap-6 border-b border-white/10 text-sm">
        {VALID_TABS.map((t) => {
          const active = t === tab;
          return (
            <Link
              key={t}
              href={`/leaderboard?tab=${t}`}
              className={`-mb-px border-b-2 px-1 py-2 font-display tracking-widest ${
                active
                  ? "border-gold text-gold"
                  : "border-transparent text-muted hover:text-white"
              }`}
            >
              {TAB_LABELS[t]}
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-muted">{TAB_DESCRIPTIONS[tab]}</p>

      {error ? (
        <p className="text-sm text-loss">Couldn't load leaderboard: {error.message}</p>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-panel p-12 text-center">
          <p className="font-display text-2xl tracking-widest text-gold">NOT ENOUGH DATA</p>
          <p className="mt-2 text-sm text-muted">
            Connect your broker and build a verified trade history to appear here.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => {
            const isPro = r.score_tier === "pro";
            const primary = isPro ? r.pro_score : r.active_score;
            const href = (r.username ? `/@${r.username}` : `/p/${r.user_id}`) as Route;
            const avatarUrl = r.avatar_path ? avatars[r.avatar_path] : null;
            return (
              <li
                key={`${r.user_id}-${r.broker_account_id}`}
                className={`rounded-xl border border-white/10 bg-panel p-4 ${rankAccent(i)}`}
              >
                <div className="flex items-start gap-4">
                  <span className="w-10 shrink-0 text-center font-display text-2xl tracking-widest text-gold">
                    #{i + 1}
                  </span>

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40 text-sm font-medium text-muted">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>{initials(r.display_name)}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={href}
                        className="truncate font-medium hover:text-gold"
                      >
                        {r.display_name ?? "Anonymous"}
                      </Link>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-display tracking-widest ${
                          isPro
                            ? "border-blue-400/40 text-blue-300"
                            : "border-green-400/40 text-green-300"
                        }`}
                      >
                        {isPro ? "🔵 VERIFIED PRO" : "🟢 ACTIVE LEADER"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-muted">
                        {r.trade_count ?? 0} trades
                      </span>
                      <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-muted">
                        {fmtNum(r.win_rate_pct, 1)}% WR
                      </span>
                      <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-muted">
                        {fmtNum(r.expectancy_pct, 2)}% EXP
                      </span>
                      <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-muted">
                        {fmtNum(r.max_drawdown_pct, 1)}% DD
                      </span>
                    </div>

                    {isPro ? (
                      <p className="mt-2 text-xs text-muted">
                        Sortino: <span className="text-white">{fmtNum(r.sortino_ratio, 2)}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end justify-between gap-2">
                    <span className="font-display text-3xl tracking-wider tabular-nums text-gold">
                      {fmtNum(primary, 1)}
                    </span>
                    <span className="text-[10px] text-muted">
                      {fmtDate(r.last_scored_at)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
