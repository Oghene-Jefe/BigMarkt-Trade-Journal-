import Link from "next/link";
import { Bot, PenLine, CircleDashed, ArrowRight } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import type { TradeRow } from "@/lib/types";
import { fmtMoney, fmtDate, fmtPct } from "@/lib/format";
import { getMonthPulse } from "@/lib/heatmap";
import { PageHeader, MetricCard, Section, StatusPill } from "@/components/ui";
import Banners from "./Banners";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

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
      <PageHeader title="Dashboard" />

      <Banners
        journalMode={journalMode}
        brokerAccountCount={brokerAccountCount}
        tradeCount={trades.length}
      />

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted">Journal mode</span>
        <ModePill mode={journalMode} />
        <Link href="/profile" className="text-muted hover:text-white">
          Change in settings
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total trades" value={String(trades.length)} />
        <MetricCard label="Win rate" value={winRate == null ? "—" : `${winRate.toFixed(0)}%`} />
        <MetricCard
          label="Net P&L"
          value={fmtMoney(totalPnl)}
          tone={totalPnl >= 0 ? "win" : "loss"}
        />
        <MetricCard
          label="Growth"
          value={fmtPct(growth)}
          tone={(growth ?? 0) >= 0 ? "win" : "loss"}
        />
      </div>

      {hasMonthActivity ? (
        <div className="text-center text-sm text-gold/70 py-2">
          This month: {pulse.winDays} win days · {pulse.lossDays} loss days · best{" "}
          <span className="text-green-400">+${pulse.bestDay.toFixed(0)}</span> · worst{" "}
          <span className="text-red-400">-${Math.abs(pulse.worstDay).toFixed(0)}</span>
        </div>
      ) : null}

      <Section
        title="Recent trades"
        action={
          <Link
            href="/journal"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
          >
            <span>View all</span>
            <ArrowRight size={12} aria-hidden />
          </Link>
        }
      >
        {recent.length === 0 ? (
          <p className="text-sm text-muted">
            No trades yet.{" "}
            <Link href="/journal/new" className="text-gold">
              Log your first.
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span className="text-muted">{fmtDate(t.created_at)}</span>
                <span className="flex-1 px-3 font-medium">{t.pair}</span>
                <span
                  className={`px-3 text-xs ${
                    t.result === "WIN"
                      ? "text-win"
                      : t.result === "LOSS"
                        ? "text-loss"
                        : "text-muted"
                  }`}
                >
                  {t.result}
                </span>
                <span
                  className={`tabular-nums ${(t.pnl ?? 0) >= 0 ? "text-win" : "text-loss"}`}
                >
                  {fmtMoney(t.pnl)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function ModePill({ mode }: { mode: "automated" | "manual" | null }) {
  if (mode === "automated") {
    return (
      <StatusPill tone="ok" icon={<Bot size={12} aria-hidden />}>
        Automated
      </StatusPill>
    );
  }
  if (mode === "manual") {
    return (
      <StatusPill tone="warn" icon={<PenLine size={12} aria-hidden />}>
        Manual
      </StatusPill>
    );
  }
  return (
    <StatusPill tone="neutral" icon={<CircleDashed size={12} aria-hidden />}>
      Not set
    </StatusPill>
  );
}
