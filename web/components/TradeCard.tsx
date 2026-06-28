import Link from "next/link";
import type { Route } from "next";
import Avatar from "@/components/ui/Avatar";
import ReactionPicker from "@/components/ReactionPicker";
import { fmtMoney, fmtDate } from "@/lib/format";

export type CardTrade = {
  trade_id: string;
  user_id: string;
  pair: string | null;
  direction: string | null;
  result: string | null;
  pnl: number | null;
  rr_ratio: number | null;
  trust_badge: string | null;
  isOpen: boolean;
  timestamp: string;
  leader_display_name: string | null;
  leader_username: string | null;
  leader_avatar_url: string | null;
};

export default function TradeCard({ trade: r }: { trade: CardTrade }) {
  const href = (r.leader_username ? `/@${r.leader_username}` : `/p/${r.user_id}`) as Route;
  const isBuy = r.direction === "BUY";
  const dirClass = isBuy ? "bg-win/15 text-win" : "bg-loss/15 text-loss";
  const pnl = r.pnl ?? 0;
  const pnlClass = pnl > 0 ? "text-win" : pnl < 0 ? "text-loss" : "text-muted";

  return (
    <article
      className={`rounded-xl border bg-panel/60 p-4 transition hover:bg-panel ${
        r.isOpen ? "border-gold/30" : "border-white/8"
      }`}
    >
      {/* Leader identity line */}
      <div className="flex items-center gap-2">
        <Link href={href} className="shrink-0">
          <Avatar url={r.leader_avatar_url} name={r.leader_display_name} size="sm" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={href} className="text-sm font-semibold text-white hover:text-gold">
            {r.leader_display_name ?? (r.leader_username ? `@${r.leader_username}` : "Trader")}
          </Link>
          {r.leader_username ? (
            <span className="ml-1.5 text-xs text-muted">@{r.leader_username}</span>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-muted">{fmtDate(r.timestamp)}</span>
      </div>

      {/* Trade hero */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl tracking-wide text-white">
              {r.pair ?? "—"}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${dirClass}`}>
              {r.direction ?? "—"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {r.isOpen ? (
              <span className="flex items-center gap-1.5 font-medium text-gold">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
                OPEN
              </span>
            ) : (
              <span
                className={`font-medium uppercase ${
                  r.result === "WIN" ? "text-win" : r.result === "LOSS" ? "text-loss" : "text-muted"
                }`}
              >
                {r.result ?? "—"}
              </span>
            )}
            {r.rr_ratio != null ? (
              <span className="text-muted">· {r.rr_ratio.toFixed(2)}R</span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className={`font-display text-2xl tabular-nums ${pnlClass}`}>{fmtMoney(r.pnl)}</div>
          <div className="text-xs text-muted">{r.isOpen ? "live P&L" : "closed P&L"}</div>
        </div>
      </div>

      {/* Reactions */}
      <div className="mt-3 border-t border-white/5 pt-2.5">
        <ReactionPicker tradeId={r.trade_id} />
      </div>
    </article>
  );
}
