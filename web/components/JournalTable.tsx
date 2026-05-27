"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Share2, Zap, ShieldCheck, Pencil } from "lucide-react";
import type { TradeRow } from "@/lib/types";
import { fmtDate, fmtMoney } from "@/lib/format";
import { deleteTradeAction } from "@/app/(app)/actions";
import ConfirmButton from "./ConfirmButton";
import TrustBadge from "./TrustBadge";
import { EmptyState, LinkButton } from "./ui";
import { Plus } from "lucide-react";

type SourceFilter = "all" | "ea" | "manual";

// All trade fields render as React text — never as raw HTML — which
// structurally prevents the stored-XSS class of bug the old static app was
// vulnerable to.
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
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const eaCount = useMemo(() => trades.filter((t) => t.source === "ea").length, [trades]);
  const manualCount = useMemo(
    () => trades.filter((t) => t.source === "manual" || t.source === null).length,
    [trades],
  );

  const visibleTrades = useMemo(() => {
    if (sourceFilter === "ea") return trades.filter((t) => t.source === "ea");
    if (sourceFilter === "manual") return trades.filter((t) => t.source === "manual" || t.source === null);
    return trades;
  }, [trades, sourceFilter]);

  const FILTER_OPTIONS: { value: SourceFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "ea", label: "EA Trades" },
    { value: "manual", label: "Manual" },
  ];

  const emptyTitle =
    sourceFilter === "ea"
      ? "No EA trades yet"
      : sourceFilter === "manual"
        ? "No manual trades"
        : "No trades yet";

  const emptyDescription =
    sourceFilter === "ea"
      ? "No EA trades yet. Download and attach the EA to start auto-journaling."
      : sourceFilter === "manual"
        ? "No manual trades. Add your first trade using the button above."
        : "Attach the EA or add a manual trade.";

  return (
    <div className="space-y-3">
      {/* Summary strip */}
      {trades.length > 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-white/10 bg-panel px-4 py-2 text-xs text-muted">
          <span>
            <span className="font-medium text-white">{eaCount}</span> EA trades
          </span>
          <span className="text-white/20">|</span>
          <span>
            <span className="font-medium text-white">{manualCount}</span> Manual trades
          </span>
        </div>
      ) : null}

      {/* Filter bar */}
      <div className="flex gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const active = opt.value === sourceFilter;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSourceFilter(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-gold text-black"
                  : "border border-white/10 bg-panel text-muted hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {visibleTrades.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            sourceFilter !== "ea" ? (
              <LinkButton href="/journal/new" icon={<Plus size={14} aria-hidden />}>
                New trade
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-panel">
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
              {visibleTrades.map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-muted">{fmtDate(t.created_at)}</td>
                  <td className="px-3 py-2">
                    {t.chart_path && chartUrls[t.chart_path] ? (
                      <a href={chartUrls[t.chart_path]} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, re-issued per render */}
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
                    <SourceBadge source={t.source} verified={t.verified} />
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
      )}
    </div>
  );
}

function SourceBadge({ source, verified }: { source: string | null; verified: boolean | null }) {
  const isEa = source === "ea";
  if (isEa) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
        <Zap className="h-3 w-3" aria-hidden />
        EA
        {verified ? <ShieldCheck className="h-3 w-3 text-green-300" aria-hidden /> : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-white/5 text-muted border border-white/10">
      <Pencil className="h-3 w-3" aria-hidden />
      Manual
    </span>
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
  // RLS + the explicit user_id check inside deleteTradeAction together
  // prevent cross-user deletes even if a client submits a forged trade id.
  return (
    <form action={deleteTradeAction.bind(null, id)}>
      <ConfirmButton
        message="Delete this trade? Its chart screenshot will also be removed."
        className="rounded border border-loss/40 px-2 py-1 text-xs text-loss hover:bg-loss/10"
      >
        Delete
      </ConfirmButton>
    </form>
  );
}
