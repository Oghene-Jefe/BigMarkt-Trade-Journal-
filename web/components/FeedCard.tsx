import Link from "next/link";
import type { Route } from "next";
import Avatar from "@/components/ui/Avatar";
import TrustBadge, { type Badge } from "@/components/TrustBadge";
import type { FeedTrade } from "@/lib/actions/feed";
import { fmtDate } from "@/lib/format";
import ReactionBar from "@/components/ReactionBar";

export default function FeedCard({ trade: r }: { trade: FeedTrade }) {
  const href = (r.leader_username ? `/@${r.leader_username}` : `/p/${r.user_id}`) as Route;
  const dirClass = r.direction === "BUY" ? "bg-win/20 text-win" : "bg-loss/20 text-loss";
  const resultClass =
    r.result === "WIN" ? "text-win" : r.result === "LOSS" ? "text-loss" : "text-muted";

  return (
    <div className="flex items-start gap-3 py-3">
      <Link href={href} className="shrink-0">
        <Avatar url={r.leader_avatar_url} name={r.leader_display_name} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link href={href} className="text-sm font-semibold text-white hover:text-gold">
            {r.leader_display_name ?? (r.leader_username ? `@${r.leader_username}` : "Trader")}
          </Link>
          {r.leader_username ? (
            <span className="text-xs text-muted">@{r.leader_username}</span>
          ) : null}
          <TrustBadge badge={(r.trust_badge ?? "manual") as Badge} />
          <span className="ml-auto shrink-0 text-xs text-muted">{fmtDate(r.created_at)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-medium text-white">{r.pair ?? "—"}</span>
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${dirClass}`}>
            {r.direction}
          </span>
          <span className={`text-xs uppercase ${resultClass}`}>{r.result ?? "—"}</span>
          {r.rr_ratio != null ? (
            <span className={`tabular-nums text-sm font-semibold ${r.rr_ratio > 0 ? "text-win" : r.rr_ratio < 0 ? "text-loss" : "text-muted"}`}>
              {r.rr_ratio > 0 ? "+" : ""}{r.rr_ratio.toFixed(2)}R
            </span>
          ) : null}
        </div>
        <ReactionBar tradeId={r.trade_id} />
      </div>
    </div>
  );
}
