import Link from "next/link";
import type { Route } from "next";
import { PageHeader, EmptyState, LinkButton, Section } from "@/components/ui";
import { fmtMoney, fmtDate } from "@/lib/format";
import { getFollowingFeedAction } from "@/lib/actions/feed";

export const dynamic = "force-dynamic";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function FeedPage() {
  const rows = await getFollowingFeedAction();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feed"
        description="Verified trades from traders you follow."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No trades yet"
          description="Follow traders to see their verified trades here."
          action={
            <LinkButton href="/leaderboard" variant="secondary">
              Browse leaderboard
            </LinkButton>
          }
        />
      ) : (
        <Section>
          <ul className="divide-y divide-white/10">
            {rows.map((r) => {
              const href = (r.leader_username
                ? `/@${r.leader_username}`
                : `/p/${r.user_id}`) as Route;
              const pnlClass =
                r.pnl == null
                  ? "text-muted"
                  : r.pnl > 0
                    ? "text-win"
                    : r.pnl < 0
                      ? "text-loss"
                      : "text-muted";

              return (
                <li
                  key={r.trade_id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-black/60">
                    {r.leader_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, re-issued per render
                      <img src={r.leader_avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-medium text-gold">
                        {initials(r.leader_display_name)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={href}
                      className="block truncate text-sm font-medium text-white hover:text-gold"
                    >
                      {r.leader_display_name ??
                        (r.leader_username ? `@${r.leader_username}` : "Anonymous")}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {r.pair ?? "—"}
                      {r.direction ? ` · ${r.direction}` : ""}
                      {r.result ? ` · ${r.result}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold ${pnlClass}`}>{fmtMoney(r.pnl)}</p>
                    <p className="text-xs text-muted">
                      {r.rr_ratio != null ? `RR ${r.rr_ratio}` : "—"} · {fmtDate(r.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
