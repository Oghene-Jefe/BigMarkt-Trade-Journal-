"use client";

import type { TradeRow } from "@/lib/types";
import { buildPsychologyReport } from "@/lib/analytics";

export default function PsychologyAdvisor({ trades }: { trades: TradeRow[] }) {
  if (trades.length < 5) {
    return (
      <div className="rounded-lg border border-white/10 bg-panel p-6">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
          TRADE PSYCHOLOGY
        </h3>
        <p className="text-sm text-muted">
          Log at least 5 trades to unlock psychology insights.
        </p>
      </div>
    );
  }

  const report = buildPsychologyReport(trades);

  return (
    <div className="rounded-lg border border-white/10 bg-panel p-6">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gold">
        TRADE PSYCHOLOGY
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-green-700/40 bg-green-900/20 p-4">
          <p className="text-xs uppercase tracking-wider text-green-400/80">
            Best Mindset
          </p>
          <p className="mt-1 font-display text-lg text-green-300">
            {report.bestEmotion || "—"}
          </p>
        </div>
        <div className="rounded-lg border border-red-700/40 bg-red-900/20 p-4">
          <p className="text-xs uppercase tracking-wider text-red-400/80">
            Worst Mindset
          </p>
          <p className="mt-1 font-display text-lg text-red-300">
            {report.worstEmotion || "—"}
          </p>
        </div>
      </div>

      {report.emotionStats.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-1.5 text-left">Emotion</th>
                <th className="py-1.5 text-right">Win Rate</th>
                <th className="py-1.5 text-right">Avg P&amp;L</th>
                <th className="py-1.5 text-right">Trades</th>
              </tr>
            </thead>
            <tbody>
              {report.emotionStats.map((e) => (
                <tr key={e.emotion} className="border-t border-white/5">
                  <td className="py-1.5">{e.emotion}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {e.winRate.toFixed(1)}%
                  </td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${e.avgPnl >= 0 ? "text-win" : "text-loss"}`}
                  >
                    ${e.avgPnl.toFixed(2)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted">
                    {e.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted">
          No emotion-tagged trades yet. Add an emotion when logging trades to
          unlock breakdowns.
        </p>
      )}

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">
          AI Insights
        </p>
        <ul className="mt-2 space-y-2">
          {report.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted">
              <span
                className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: "#D4AF37" }}
              />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
