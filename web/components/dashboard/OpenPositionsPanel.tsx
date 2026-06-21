"use client";

import { useEffect, useState, useCallback } from "react";
import { getOpenPositionsAction, type OpenPosition } from "@/lib/actions/open-positions";

type Props = {
  accountId: string | null;
};

function fmtTime(d: string | null | undefined): string {
  if (!d) return "—";
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPrice(n: number | null): string {
  if (n == null || n === 0) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

export default function OpenPositionsPanel({ accountId }: Props) {
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getOpenPositionsAction(accountId);
      setPositions(data);
    } catch {
      // silently fail — panel degrades gracefully
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) return null;

  return (
    <section className="rounded-lg border border-white/10 bg-panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-white">Open Positions</h2>
        {positions.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>{positions.length} live</span>
          </div>
        )}
      </div>

      {positions.length === 0 ? (
        <div className="mt-4 text-center py-6">
          <p className="text-sm font-medium text-white/70">No open positions</p>
          <p className="mt-1 text-xs text-muted">Your active trades will appear here</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {positions.map((pos) => (
            <li
              key={pos.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>

              <span className="font-semibold text-white min-w-[60px]">
                {pos.pair ?? "—"}
              </span>

              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  pos.direction === "BUY"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : pos.direction === "SELL"
                    ? "bg-red-500/20 text-red-300"
                    : "bg-white/10 text-white/50"
                }`}
              >
                {pos.direction ?? "—"}
              </span>

              <span className="text-muted">
                <span className="text-white/40 text-xs">Lots </span>
                {pos.lot_size ?? "—"}
              </span>

              <span className="text-muted">
                <span className="text-white/40 text-xs">@ </span>
                <span className="font-mono text-white/80">{fmtPrice(pos.entry_price)}</span>
              </span>

              <span className="text-xs text-muted">{fmtTime(pos.open_time ?? pos.created_at)}</span>

              {pos.sl != null && pos.sl !== 0 && (
                <span className="text-xs text-red-400/70">
                  SL {fmtPrice(pos.sl)}
                </span>
              )}
              {pos.tp != null && pos.tp !== 0 && (
                <span className="text-xs text-emerald-400/70">
                  TP {fmtPrice(pos.tp)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
