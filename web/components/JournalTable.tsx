"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Share2, Zap, ShieldCheck, Pencil, Cloud } from "lucide-react";
import type { TradeRow } from "@/lib/types";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { chartProxyUrl } from "@/lib/chart-url";
import { computeRR } from "@/lib/rr";
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
// Charts load through the same-origin /c/<tradeId> proxy, which hides the
// Supabase signed URL and gates access server-side (migration 0061).
export default function JournalTable({
  trades,
  violationCounts = {},
}: {
  trades: TradeRow[];
  violationCounts?: Record<string, number>;
}) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const router = useRouter();

  // Hide cancelled orders from all tabs
  const nonCancelledTrades = useMemo(
    () => trades.filter((t) => t.order_status !== "cancelled"),
    [trades],
  );

  const eaCount = useMemo(() => nonCancelledTrades.filter((t) => t.source === "ea").length, [nonCancelledTrades]);
  const manualCount = useMemo(
    () => nonCancelledTrades.filter((t) => t.source === "manual" || t.source === null).length,
    [nonCancelledTrades],
  );

  const visibleTrades = useMemo(() => {
    if (sourceFilter === "ea") return nonCancelledTrades.filter((t) => t.source === "ea");
    if (sourceFilter === "manual") return nonCancelledTrades.filter((t) => t.source === "manual" || t.source === null);
    return nonCancelledTrades;
  }, [nonCancelledTrades, sourceFilter]);

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
      {nonCancelledTrades.length > 0 ? (
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
              {visibleTrades.map((t) => {
                const isClosed = t.status === "closed" || t.status == null;
                const isOpen = t.status === "open";
                const isPending = t.order_status === "pending" || t.order_status === "modified";
                return (
                  <tr
                    key={t.id}
                    className="border-t border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => router.push(`/journal/${t.id}`)}
                  >
                    <td className="px-3 py-2 text-muted">{fmtDateTime((t as any).open_time ?? t.created_at)}</td>
                    <td className="px-3 py-2">
                      {t.chart_path ? (
                        <a
                          href={chartProxyUrl(t.id, t.chart_path)}
                          target="_blank"
                          rel="noopener"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin /c/<id> chart proxy */}
                          <img
                            src={chartProxyUrl(t.id, t.chart_path)}
                            alt=""
                            className="h-8 w-12 rounded object-cover"
                            loading="lazy"
                          />
                        </a>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {t.pair ?? "—"}
                        {(violationCounts[t.id] ?? 0) > 0 ? (
                          <span
                            title={`${violationCounts[t.id]} rule deviation${violationCounts[t.id] === 1 ? "" : "s"}`}
                            className="inline-flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
                          >
                            ⚑ {violationCounts[t.id]}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${t.direction === "BUY" ? "bg-win/20 text-win" : "bg-loss/20 text-loss"}`}>
                        {t.direction ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <ResultCell result={t.result} isClosed={isClosed} isOpen={isOpen} isPending={isPending} />
                    </td>
                    <td className="px-3 py-2">
                      <SourceBadge source={t.source} verified={t.verified} trustBadge={t.trust_badge} />
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${isClosed ? ((t.pnl ?? 0) >= 0 ? "text-win" : "text-loss") : "text-muted"}`}>
                      {isClosed ? fmtMoney(t.pnl) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      <RRCell t={t} isClosed={isClosed} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{t.tags ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      <VisibilityPill v={t.visibility} />
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/journal/${t.id}`}
                          title="View & Share"
                          aria-label="View & Share"
                          className="inline-flex items-center justify-center rounded border border-transparent p-1.5 text-gold hover:bg-gold/10"
                        >
                          <Share2 className="h-4 w-4" />
                        </Link>
                        {t.source === "ea" ? (
                          // EA trades: core fields are locked, but the trader can
                          // still add context (notes, tags, grade, chart…).
                          <Link
                            href={`/journal/${t.id}/edit`}
                            title="Core fields locked — you can add notes, tags & grade."
                            aria-label="Add context — notes, tags & grade"
                            className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-xs text-muted hover:bg-white/5 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Context
                          </Link>
                        ) : (
                          <>
                            <Link href={`/journal/${t.id}/edit`} className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/5">
                              Edit
                            </Link>
                            <DeleteForm id={t.id} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ResultCell({
  result,
  isClosed,
  isOpen,
  isPending,
}: {
  result: TradeRow["result"];
  isClosed: boolean;
  isOpen: boolean;
  isPending: boolean;
}) {
  // isPending first: pending orders arrive with status='closed' (DB default),
  // so order_status must be checked before falling through to the closed badge.
  if (isPending) {
    return (
      <span className="rounded px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
        PENDING
      </span>
    );
  }
  if (isOpen) {
    return (
      <span className="rounded px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
        LIVE
      </span>
    );
  }
  if (isClosed) {
    return (
      <span
        className={`text-xs uppercase font-medium ${
          result === "WIN" ? "text-win" : result === "LOSS" ? "text-loss" : "text-muted"
        }`}
      >
        {result ?? "—"}
      </span>
    );
  }
  return <span className="text-xs text-muted">—</span>;
}

function RRCell({ t, isClosed }: { t: TradeRow; isClosed: boolean }) {
  if (t.stop_loss == null) {
    return <span className="text-[10px] text-white/30 italic">no SL</span>;
  }
  const rr = computeRR({
    entry: t.entry_price,
    exit: t.exit_price,
    stopLoss: t.stop_loss,
    takeProfit: t.take_profit,
    storedRR: t.rr_ratio,
    isClosed,
  });
  return <span>{rr != null ? `${rr}R` : "—"}</span>;
}

function SourceBadge({
  source,
  verified,
  trustBadge,
}: {
  source: string | null;
  verified: boolean | null;
  trustBadge?: string | null;
}) {
  const isEa = source === "ea";
  if (isEa) {
    if (trustBadge === "demo") {
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
          <Zap className="h-3 w-3" aria-hidden />
          Demo EA
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
        <Zap className="h-3 w-3" aria-hidden />
        EA
        {verified ? <ShieldCheck className="h-3 w-3 text-green-300" aria-hidden /> : null}
      </span>
    );
  }
  if (source === "metaapi") {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-gold/15 text-gold border border-gold/30">
        <Cloud className="h-3 w-3" aria-hidden />
        Cloud
        {verified ? <ShieldCheck className="h-3 w-3 text-gold" aria-hidden /> : null}
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
