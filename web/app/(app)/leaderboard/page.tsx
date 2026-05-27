import Link from "next/link";
import type { Route } from "next";
import { ShieldCheck, Info } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatars } from "@/lib/storage";
import { PageHeader, EmptyState } from "@/components/ui";
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
  all: "All leaders",
  pro: "Pro traders",
  active: "Active traders",
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

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = Date.now() - t;
  const day = 86_400_000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return "scored today";
  if (days < 7) return `scored ${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `scored ${weeks}w ago`;
}

function rankAccentStyle(rank: number): { className: string; style?: React.CSSProperties } {
  if (rank === 0) return { className: "border-l-4 border-l-gold" };
  if (rank === 1) return { className: "border-l-4", style: { borderLeftColor: "#94a3b8" } };
  if (rank === 2) return { className: "border-l-4", style: { borderLeftColor: "#b45309" } };
  return { className: "border-l border-l-white/10" };
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
  // Audit N-H3: previously the page rendered `error.message` directly to
  // the user, leaking the get_leaderboard_scores RPC's PostgREST error
  // shape (table names, RLS-policy names). Log server-side; show a
  // generic message in the UI.
  if (error) {
    console.error("[leaderboard_rpc]", { code: error.code, message: error.message });
  }
  const rows = (data ?? []) as LeaderboardScoreEntry[];
  const paths = rows.map((r) => r.avatar_path).filter((p): p is string => !!p);
  const avatars = await signAvatars(paths);

  return (
    <div className="space-y-4">
      <PageHeader title="Leaderboard" />

      <div className="flex gap-6 border-b border-white/10 text-sm">
        {VALID_TABS.map((t) => {
          const active = t === tab;
          return (
            <Link
              key={t}
              href={`/leaderboard?tab=${t}`}
              className={`-mb-px border-b-2 px-1 py-2 font-medium ${
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

      {/* Verified-trades-only notice */}
      <div className="flex items-start gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Rankings are based on verified automated trades only. Manual journal entries do not affect your ranking.
        </span>
      </div>

      {error ? (
        <p className="text-sm text-loss">Couldn't load leaderboard right now. Try again shortly.</p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="Not enough data yet"
          description="Connect your broker and build a verified trade history to appear here."
        />
      ) : (
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r, i) => {
            const isPro = r.score_tier === "pro";
            const primary = isPro ? r.pro_score : r.active_score;
            const scoreLabel = isPro ? "PRO SCORE" : "ACTIVE SCORE";
            const href = (r.username ? `/@${r.username}` : `/p/${r.user_id}`) as Route;
            const avatarUrl = r.avatar_path ? avatars[r.avatar_path] : null;
            const accent = rankAccentStyle(i);
            const isTop3 = i < 3;
            const rank = i + 1;

            return (
              <li
                key={`${r.user_id}-${r.broker_account_id}`}
                style={accent.style}
                className={`relative flex flex-col gap-4 rounded-lg border border-white/10 bg-panel p-5 transition-colors hover:border-white/20 ${accent.className}`}
              >
                {/* Top row: rank + avatar */}
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span
                      className={`font-display text-4xl leading-none tracking-widest ${
                        isTop3 ? "text-gold" : "text-white/70"
                      }`}
                    >
                      #{rank}
                    </span>
                  </div>

                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-black/60 ${
                      isTop3 ? "border-gold/60" : "border-white/15"
                    }`}
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, re-issued per render
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-display text-sm tracking-wider text-gold">
                        {initials(r.display_name)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Name + tier */}
                <div className="min-w-0">
                  <Link
                    href={href}
                    className="block truncate text-lg font-bold text-white hover:text-gold"
                  >
                    {r.display_name ?? "Anonymous"}
                  </Link>
                  <div className="mt-1.5">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${
                        isPro
                          ? "border-blue-400/30 bg-blue-500/15 text-blue-300"
                          : "border-green-400/30 bg-green-500/15 text-green-300"
                      }`}
                    >
                      {isPro ? "Verified pro" : "Active trader"}
                    </span>
                  </div>
                </div>

                {/* Score block */}
                <div>
                  <p className="text-[10px] font-display tracking-widest text-muted">
                    {scoreLabel}
                  </p>
                  <p className="font-display text-5xl leading-none tracking-wider tabular-nums text-gold">
                    {fmtNum(primary, 1)}
                  </p>
                </div>

                {/* Metric pills */}
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <MetricPill label="Trades" value={`${r.trade_count ?? 0}`} />
                  <MetricPill label="WR" value={`${fmtNum(r.win_rate_pct, 1)}%`} />
                  <MetricPill label="EXP" value={`${fmtNum(r.expectancy_pct, 2)}%`} />
                  <MetricPill label="DD" value={`${fmtNum(r.max_drawdown_pct, 1)}%`} />
                  {isPro ? (
                    <MetricPill label="SR" value={fmtNum(r.sortino_ratio, 2)} />
                  ) : null}
                </div>

                {/* Footer */}
                <div className="mt-auto flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-400">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    Verified trades only
                  </span>
                  <span className="text-[10px] text-muted">
                    {fmtRelative(r.last_scored_at)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 py-1">
      <span className="font-display tracking-widest text-muted">{label}</span>
      <span className="tabular-nums text-white">{value}</span>
    </span>
  );
}
