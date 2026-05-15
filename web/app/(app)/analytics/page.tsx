import { supabaseServer } from "@/lib/supabase/server";
import type { TradeRow } from "@/lib/types";
import { fmtMoney, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

type Bucket = {
  key: string;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
};

function aggregate(trades: TradeRow[], pick: (t: TradeRow) => string | null): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const t of trades) {
    if (t.visibility === "exclude") continue;
    const k = pick(t);
    if (!k) continue;
    let b = map.get(k);
    if (!b) {
      b = { key: k, trades: 0, wins: 0, losses: 0, pnl: 0 };
      map.set(k, b);
    }
    b.trades++;
    b.pnl += t.pnl ?? 0;
    if (t.result === "WIN") b.wins++;
    else if (t.result === "LOSS") b.losses++;
  }
  return Array.from(map.values()).sort((a, b) => b.pnl - a.pnl);
}

export default async function AnalyticsPage() {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("trades").select("*");

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl tracking-widest text-gold">ANALYTICS</h1>
        </div>
        <div className="rounded-2xl border border-loss/30 bg-loss/10 p-8 text-center">
          <p className="font-display text-lg tracking-widest text-loss">FAILED TO LOAD</p>
          <p className="mt-2 text-sm text-muted">Failed to load analytics data. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  const trades = (data ?? []) as TradeRow[];

  const byPair = aggregate(trades, (t) => t.pair);
  const bySession = aggregate(trades, (t) => t.session);
  const byEmotion = aggregate(trades, (t) => t.emotions);
  const byGrade = aggregate(trades, (t) => t.setup_grade);
  const byStrategy = aggregate(trades, (t) => t.strategy);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-widest text-gold">ANALYTICS</h1>
        <p className="text-xs text-muted">
          Computed from your trades only. Trades marked `exclude` are skipped.
        </p>
      </div>

      {trades.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-panel p-12 text-center">
          <p className="font-display text-2xl tracking-widest text-gold">NO DATA</p>
          <p className="mt-2 text-sm text-muted">Log a few trades to see analytics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Section title="By Pair" buckets={byPair} />
          <Section title="By Session" buckets={bySession} />
          <Section title="By Emotion" buckets={byEmotion} />
          <Section title="By Setup Grade" buckets={byGrade} />
          <Section title="By Strategy" buckets={byStrategy} />
        </div>
      )}
    </div>
  );
}

function Section({ title, buckets }: { title: string; buckets: Bucket[] }) {
  if (buckets.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-panel p-4">
        <h2 className="font-display text-lg tracking-widest text-gold">{title.toUpperCase()}</h2>
        <p className="mt-2 text-xs text-muted">No tagged data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-4">
      <h2 className="font-display text-lg tracking-widest text-gold">{title.toUpperCase()}</h2>
      <div className="overflow-x-auto">
      <table className="mt-3 w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="py-1 text-left"></th>
            <th className="py-1 text-right">Trades</th>
            <th className="py-1 text-right">WR</th>
            <th className="py-1 text-right">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => {
            const closed = b.wins + b.losses;
            const wr = closed > 0 ? (b.wins / closed) * 100 : null;
            return (
              <tr key={b.key} className="border-t border-white/5">
                <td className="py-1.5 truncate" style={{ maxWidth: 200 }}>{b.key}</td>
                <td className="py-1.5 text-right tabular-nums">{b.trades}</td>
                <td className="py-1.5 text-right tabular-nums text-muted">{fmtPct(wr)}</td>
                <td className={`py-1.5 text-right tabular-nums ${b.pnl >= 0 ? "text-win" : "text-loss"}`}>
                  {fmtMoney(b.pnl)}
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
