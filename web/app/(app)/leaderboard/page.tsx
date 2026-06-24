import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatars } from "@/lib/storage";
import { PageHeader, EmptyState } from "@/components/ui";
import type { ScoreTier, Subscription } from "@/lib/types";
import FollowButton from "@/components/FollowButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Bare title; the root layout's `%s — BigMarkt` template adds the brand
  // suffix for child segments. Including it here would double the suffix.
  title: "Trader Leaderboard",
  description:
    "See how ranked traders stack up on BigMarkt — sorted by verified scores, win rate, expectancy, and drawdown.",
  alternates: { canonical: "/leaderboard" },
};

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

function rankAccentStyle(rank: number): { className: string } {
  if (rank === 0) return { className: "border-l-4 border-l-gold" };
  if (rank === 1) return { className: "border-l-4 border-l-gold/50" };
  if (rank === 2) return { className: "border-l-4 border-l-gold/25" };
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
  const [{ data, error }, { data: { user } }] = await Promise.all([
    sb.rpc("get_leaderboard_scores", { p_tier: tab, p_limit: 50 }),
    sb.auth.getUser(),
  ]);
  // Audit N-H3: previously the page rendered `error.message` directly to
  // the user, leaking the get_leaderboard_scores RPC's PostgREST error
  // shape (table names, RLS-policy names). Log server-side; show a
  // generic message in the UI.
  if (error) {
    console.error("[leaderboard_rpc]", { code: error.code, message: error.message });
  }
  const rows = (data ?? []) as LeaderboardScoreEntry[];
  const currentUserId = user?.id ?? null;

  // Batch-fetch existing follows for all leader cards in one query.
  const subMap = new Map<string, Subscription>();
  if (currentUserId && rows.length > 0) {
    const leaderIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: subRows } = await sb
      .from("subscriptions")
      .select("*")
      .eq("follower_id", currentUserId)
      .in("leader_id", leaderIds)
      .neq("status", "cancelled");
    for (const s of (subRows ?? []) as Subscription[]) {
      subMap.set(s.leader_id, s);
    }
  }

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
                          ? "border-gold/40 bg-gold/15 text-gold"
                          : "border-white/15 bg-white/5 text-muted"
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
                <div className="mt-auto flex items-center justify-between gap-2">
                  <FollowButton
                    leaderId={r.user_id}
                    leaderUsername={r.username}
                    currentUserId={currentUserId}
                    existingSubscription={subMap.get(r.user_id) ?? null}
                  />
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
