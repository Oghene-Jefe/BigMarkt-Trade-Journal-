import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { TradeRow } from "@/lib/types";
import { fmtMoney, fmtDate, fmtPct } from "@/lib/format";
import { getMonthPulse } from "@/lib/heatmap";
import Banners from "./Banners";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  // Layout already redirects unauthed users; user is guaranteed to exist here.

  const [{ data: tradesData }, { data: profileData }, { count: brokerAccountCountRaw }] =
    await Promise.all([
      sb.from("trades").select("*").order("created_at", { ascending: false }),
      sb.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
      sb
        .from("broker_accounts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id),
    ]);
  const brokerAccountCount = brokerAccountCountRaw ?? 0;
  const trades = (tradesData ?? []) as TradeRow[];
  const startBal = profileData?.starting_balance ?? null;
  const journalMode = (profileData?.journal_mode ?? null) as
    | "automated"
    | "manual"
    | null;

  const modeBadge =
    journalMode === "automated"
      ? { text: "🤖 Automated Mode", className: "bg-green-900 text-green-300" }
      : journalMode === "manual"
        ? { text: "✍️ Manual Mode", className: "bg-yellow-900 text-yellow-300" }
        : { text: "⚪ Mode Not Set", className: "bg-gray-700 text-gray-300" };

  const wins = trades.filter((t) => t.result === "WIN").length;
  const losses = trades.filter((t) => t.result === "LOSS").length;
  const closed = wins + losses;
  const winRate = closed > 0 ? (wins / closed) * 100 : null;
  const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const growth = startBal && startBal > 0 ? (totalPnl / startBal) * 100 : null;
  const recent = trades.slice(0, 5);

  const nowForPulse = new Date();
  const pulse = getMonthPulse(
    trades,
    nowForPulse.getFullYear(),
    nowForPulse.getMonth(),
  );
  const hasMonthActivity =
    pulse.winDays > 0 ||
    pulse.lossDays > 0 ||
    pulse.bestDay !== 0 ||
    pulse.worstDay !== 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-widest text-gold">DASHBOARD</h1>

      <Banners
        journalMode={journalMode}
        brokerAccountCount={brokerAccountCount}
        tradeCount={trades.length}
      />

      <div className="inline-flex flex-col gap-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-200">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${modeBadge.className}`}>
          {modeBadge.text}
        </span>
        <div className="mt-1">
          <Link href="/profile" className="text-xs text-muted hover:text-white">
            Change in Settings →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Trades" value={String(trades.length)} />
        <Stat label="Win Rate" value={winRate == null ? "—" : `${winRate.toFixed(0)}%`} />
        <Stat label="Net P&L" value={fmtMoney(totalPnl)} tone={totalPnl >= 0 ? "win" : "loss"} />
        <Stat label="Growth" value={fmtPct(growth)} tone={(growth ?? 0) >= 0 ? "win" : "loss"} />
      </div>

      {hasMonthActivity ? (
        <div className="text-sm text-center text-gold/70 py-2">
          This month: {pulse.winDays} win days · {pulse.lossDays} loss days · best{" "}
          <span className="text-green-400">+${pulse.bestDay.toFixed(0)}</span> · worst{" "}
          <span className="text-red-400">-${Math.abs(pulse.worstDay).toFixed(0)}</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl tracking-widest text-gold">RECENT TRADES</h2>
          <Link href="/journal" className="text-xs text-muted hover:text-white">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">No trades yet. <Link href="/journal/new" className="text-gold">Log your first.</Link></p>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span className="text-muted">{fmtDate(t.created_at)}</span>
                <span className="flex-1 px-3 font-medium">{t.pair}</span>
                <span className={`px-3 text-xs ${t.result === "WIN" ? "text-win" : t.result === "LOSS" ? "text-loss" : "text-muted"}`}>
                  {t.result}
                </span>
                <span className={`tabular-nums ${(t.pnl ?? 0) >= 0 ? "text-win" : "text-loss"}`}>
                  {fmtMoney(t.pnl)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "win" | "loss" }) {
  const colour = tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : "text-white";
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-panel p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 truncate font-display text-2xl tracking-wider ${colour}`}>{value}</p>
    </div>
  );
}
