"use client";

import { useState } from "react";
import { approveImportsAction, ignoreImportsAction } from "./actions";
import { fmtMoney, fmtDate } from "@/lib/format";

export type PendingImport = {
  id: string;
  exchange: string;
  category: string;
  symbol: string;
  side: "Buy" | "Sell" | null;
  qty: number | null;
  closed_size: number | null;
  avg_entry_price: number | null;
  avg_exit_price: number | null;
  closed_pnl: number | null;
  open_fee: number | null;
  close_fee: number | null;
  closed_at: string | null;
  exchange_order_id: string;
  connection_label: string | null;
};

// Single client component covering selection + two submit buttons. Each
// button submits its own formAction so the user can approve or ignore
// the same selected set without changing the source of truth.
export default function ImportsTable({ rows }: { rows: PendingImport[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => (s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  const selectedIds = Array.from(selected);
  const canAct = selectedIds.length > 0;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-panel p-12 text-center">
        <p className="text-base font-medium text-white">Nothing to review</p>
        <p className="mt-2 text-sm text-muted">
          Closed-PnL rows from Bybit syncs land here as pending. Click Sync on /exchanges to fetch the latest window.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs">
        <span className="text-muted">
          {rows.length} pending · {selectedIds.length} selected
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="rounded border border-white/20 px-2 py-1 hover:bg-white/5"
          >
            {selected.size === rows.length ? "Clear" : "Select all"}
          </button>
          <form action={approveImportsAction}>
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <button
              disabled={!canAct}
              className="rounded-md bg-gold px-3 py-1 text-xs font-medium text-black disabled:opacity-40"
            >
              Approve
            </button>
          </form>
          <form action={ignoreImportsAction}>
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <button
              disabled={!canAct}
              className="rounded border border-loss/40 px-3 py-1 text-loss hover:bg-loss/10 disabled:opacity-40"
            >
              Ignore
            </button>
          </form>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-panel">
        <table className="w-full text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2 text-left"></th>
              <th className="px-3 py-2 text-left">Closed</th>
              <th className="px-3 py-2 text-left">Symbol</th>
              <th className="px-3 py-2 text-left">Side</th>
              <th className="px-3 py-2 text-right">Size</th>
              <th className="px-3 py-2 text-right">Entry</th>
              <th className="px-3 py-2 text-right">Exit</th>
              <th className="px-3 py-2 text-right">P&amp;L</th>
              <th className="px-3 py-2 text-right">Fees</th>
              <th className="px-3 py-2 text-left">Connection</th>
              <th className="px-3 py-2 text-left">Order ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const fees = Number(r.open_fee ?? 0) + Number(r.close_fee ?? 0);
              const pnl = Number(r.closed_pnl ?? 0);
              return (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-3 py-2 text-muted">{fmtDate(r.closed_at)}</td>
                  <td className="px-3 py-2 font-medium">{r.symbol}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        r.side === "Buy" ? "bg-win/20 text-win" : "bg-loss/20 text-loss"
                      }`}
                    >
                      {r.side ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">
                    {r.closed_size ?? r.qty ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.avg_entry_price ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.avg_exit_price ?? "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      pnl >= 0 ? "text-win" : "text-loss"
                    }`}
                  >
                    {fmtMoney(pnl)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">
                    {fmtMoney(fees)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {r.connection_label ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">
                    {r.exchange_order_id.slice(0, 12)}…
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
