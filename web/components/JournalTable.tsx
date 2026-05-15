import Link from "next/link";
import { Share2 } from "lucide-react";
import type { TradeRow } from "@/lib/types";
import { fmtDate, fmtMoney } from "@/lib/format";
import { deleteTradeAction } from "@/app/(app)/actions";
import ConfirmButton from "./ConfirmButton";
import TrustBadge from "./TrustBadge";

// Server component. All trade fields render as React text — never as raw
// HTML — which structurally prevents the stored-XSS class of bug the old
// static app was vulnerable to.
//
// chartUrls is a path → signed URL lookup minted by the parent page so we
// only round-trip Storage once for the whole list. URLs expire on the next
// request, so a cached page can't be replayed forever.
export default function JournalTable({
  trades,
  chartUrls,
}: {
  trades: TradeRow[];
  chartUrls: Record<string, string>;
}) {
  if (trades.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-panel p-12 text-center">
        <p className="font-display text-2xl tracking-widest text-gold">NO TRADES YET</p>
        <p className="mt-2 text-sm text-muted">Log your first trade to start the journal.</p>
        <Link href="/journal/new" className="mt-6 inline-block rounded-md bg-gold px-5 py-2 font-display tracking-widest text-black">
          NEW TRADE
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-panel">
      <table className="w-full text-sm">
        <thead className="bg-black/30 text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2"></th>
            <th className="px-3 py-2 text-left">Pair</th>
            <th className="px-3 py-2 text-left">Dir</th>
            <th className="px-3 py-2 text-left">Result</th>
            <th className="px-3 py-2 text-left">Source</th>
            <th className="px-3 py-2 text-right">P&amp;L</th>
            <th className="px-3 py-2 text-right">R:R</th>
            <th className="px-3 py-2 text-left">Tags</th>
            <th className="px-3 py-2 text-left">Visibility</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-t border-white/5">
              <td className="px-3 py-2 text-muted">{fmtDate(t.created_at)}</td>
              <td className="px-3 py-2">
                {t.chart_path && chartUrls[t.chart_path] ? (
                  <a href={chartUrls[t.chart_path]} target="_blank" rel="noreferrer">
                    <img
                      src={chartUrls[t.chart_path]}
                      alt=""
                      className="h-8 w-12 rounded object-cover"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </td>
              <td className="px-3 py-2 font-medium">{t.pair ?? "—"}</td>
              <td className="px-3 py-2">
                <span className={`rounded px-2 py-0.5 text-xs ${t.direction === "BUY" ? "bg-win/20 text-win" : "bg-loss/20 text-loss"}`}>
                  {t.direction ?? "—"}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className={`text-xs uppercase ${t.result === "WIN" ? "text-win" : t.result === "LOSS" ? "text-loss" : "text-muted"}`}>
                  {t.result ?? "—"}
                </span>
              </td>
              <td className="px-3 py-2">
                <TrustBadge badge={t.trust_badge ?? 'manual'} />
              </td>
              <td className={`px-3 py-2 text-right tabular-nums ${(t.pnl ?? 0) >= 0 ? "text-win" : "text-loss"}`}>
                {fmtMoney(t.pnl)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">
                {t.rr_ratio != null ? t.rr_ratio.toFixed(2) : "—"}
              </td>
              <td className="px-3 py-2 text-xs text-muted">{t.tags ?? "—"}</td>
              <td className="px-3 py-2 text-xs">
                <VisibilityPill v={t.visibility} />
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/trades/${t.id}`}
                    title="View & Share"
                    aria-label="View & Share"
                    className="inline-flex items-center justify-center rounded border border-transparent p-1.5 text-gold hover:bg-gold/10"
                  >
                    <Share2 className="h-4 w-4" />
                  </Link>
                  <Link href={`/journal/${t.id}/edit`} className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/5">
                    Edit
                  </Link>
                  <DeleteForm id={t.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VisibilityPill({ v }: { v: TradeRow["visibility"] }) {
  const map = {
    private: "bg-white/10 text-muted",
    public: "bg-gold/20 text-gold",
    exclude: "bg-loss/20 text-loss",
    followers_only: "bg-blue-500/20 text-blue-400",
  } as const;
  return <span className={`rounded px-2 py-0.5 ${map[v]}`}>{v}</span>;
}

function DeleteForm({ id }: { id: string }) {
  // Server action via form. RLS + the explicit user_id check inside
  // deleteTradeAction together prevent cross-user deletes even if a client
  // submits a forged trade id.
  async function action() {
    "use server";
    await deleteTradeAction(id);
  }
  return (
    <form action={action}>
      <ConfirmButton
        message="Delete this trade? Its chart screenshot will also be removed."
        className="rounded border border-loss/40 px-2 py-1 text-xs text-loss hover:bg-loss/10"
      >
        Delete
      </ConfirmButton>
    </form>
  );
}
