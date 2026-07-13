import Link from "next/link";
import { Bot, PenLine, CircleDashed, ArrowRight } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import type { TradeRow } from "@/lib/types";
import { fmtMoney, fmtDate, fmtPct } from "@/lib/format";
import { getMonthPulse } from "@/lib/heatmap";
import { getActiveAccount } from "@/lib/accounts";
import { computeAdherence } from "@/lib/constitution/adherence";
import { PageHeader, MetricCard, Section, StatusPill } from "@/components/ui";
import { buildActivationSummary } from "@/lib/activation";
import Banners from "./Banners";
import ActivationPanel from "./ActivationPanel";
import OpenPositionsPanel from "@/components/dashboard/OpenPositionsPanel";
import LiveFollowingStrip from "@/components/dashboard/LiveFollowingStrip";
import { getFollowingOpenPositionsAction } from "@/lib/actions/feed";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  // The active account (driven by the global switcher in the shell) is the
  // single source of truth for what the dashboard shows.
  const { activeId } = await getActiveAccount(sb, user!.id);

  // Compact rule-adherence stat (null when no active constitution / nothing evaluated).
  const adherence = await computeAdherence(sb, user!.id);
  const adherencePct = adherence?.pct ?? null;

  const [
    { data: tradesData },
    { data: profileData },
    { count: brokerAccountCountRaw },
    { count: eaTokenCountRaw },
    followingOpenPositions,
  ] = await Promise.all([
    sb.from("trades").select("*").order("created_at", { ascending: false }),
    sb.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
    sb
      .from("broker_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id),
    sb
      .from("ea_tokens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .is("revoked_at", null),
    getFollowingOpenPositionsAction(),
  ]);

  const brokerAccountCount = brokerAccountCountRaw ?? 0;
  const eaTokenCount = eaTokenCountRaw ?? 0;
  const allTrades = (tradesData ?? []) as TradeRow[];

  // Scope all dashboard data to the active account.
  const trades = activeId
    ? allTrades.filter((t) => {
        const row = t as TradeRow & { broker_account_id?: string | null };
        return row.broker_account_id === activeId;
      })
    : allTrades;

  const closedTrades = trades.filter(
    (t) => (t as TradeRow & { status?: string | null }).status === "closed" ||
            (t as TradeRow & { status?: string | null }).status == null
  );

  // Pull the active account's live balance snapshot (seeded by the EA). Used
  // for both the balance-based Growth figure and the live-balance subline.
  let acctStartBal: number | null = null;
  let acctCurrentBal: number | null = null;
  let acctCurrency: string | null = null;
  if (activeId) {
    const { data: acctRow } = await sb
      .from("broker_accounts")
      .select("starting_balance, current_balance, current_equity, account_currency")
      .eq("id", activeId)
      .maybeSingle();
    acctStartBal = (acctRow?.starting_balance as number | null) ?? null;
    acctCurrentBal = (acctRow?.current_balance as number | null) ?? null;
    acctCurrency = (acctRow?.account_currency as string | null) ?? null;
  }
  let cloudGain: number | null = null;
  let cloudBalance: number | null = null;
  if (activeId) {
    const { data: connMetrics } = await sb
      .from("metaapi_connections")
      .select("gain, balance")
      .eq("broker_account_id", activeId)
      .maybeSingle();
    cloudGain = (connMetrics?.gain as number | null) ?? null;
    cloudBalance = (connMetrics?.balance as number | null) ?? null;
  }
  const startBal = acctStartBal ?? profileData?.starting_balance ?? null;
  const journalMode = (profileData?.journal_mode ?? null) as
    | "automated"
    | "manual"
    | null;

  const activationSummary = buildActivationSummary({
    displayName: profileData?.display_name ?? null,
    username: profileData?.username ?? null,
    journalMode,
    visibility: profileData?.visibility ?? null,
    tradeCount: allTrades.length,
    brokerAccountCount,
    eaTokenCount,
  });

  const wins = closedTrades.filter((t) => t.result === "WIN").length;
  const losses = closedTrades.filter((t) => t.result === "LOSS").length;
  const closed = wins + losses;
  const winRate = closed > 0 ? (wins / closed) * 100 : null;
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  // Balance-based growth when we have a real live balance + baseline; otherwise
  // fall back to the P&L proxy (totalPnl / starting balance).
  // Cloud accounts: use MetaStats' deposit/withdrawal-correct gain% (the same
  // number the account detail card shows) instead of the naive balance-vs-start,
  // which misreads deposits/withdrawals.
  const growth =
    cloudGain != null
      ? cloudGain
      : acctCurrentBal != null && acctStartBal != null && acctStartBal !== 0
        ? ((acctCurrentBal - acctStartBal) / acctStartBal) * 100
        : startBal && startBal > 0
          ? (totalPnl / startBal) * 100
          : null;
  const growthSubline =
    cloudGain != null
      ? cloudBalance != null
        ? `Balance ${fmtMoney(cloudBalance, acctCurrency)}`
        : null
      : acctCurrentBal != null
        ? `${fmtMoney(acctCurrentBal, acctCurrency)} · start ${fmtMoney(acctStartBal, acctCurrency)}`
        : null;
  const recent = closedTrades.slice(0, 5);

  const nowForPulse = new Date();
  const pulse = getMonthPulse(
    closedTrades,
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

      <ActivationPanel summary={activationSummary} />

      {activationSummary.nextStep === null ? (
        <Banners
          journalMode={journalMode}
          brokerAccountCount={brokerAccountCount}
          tradeCount={allTrades.length}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted">Journal mode</span>
        <ModePill mode={journalMode} />
        <Link href="/profile" className="text-muted hover:text-white">
          Change in settings
        </Link>
        <span className="text-white/20">·</span>
        <Link href="/constitution" className="text-muted hover:text-white">
          Rule adherence{" "}
          <span className="font-medium text-white">
            {adherencePct == null ? "—" : `${adherencePct}%`}
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total trades" value={String(closedTrades.length)} />
        <MetricCard label="Win rate" value={winRate == null ? "—" : `${winRate.toFixed(0)}%`} />
        <MetricCard
          label="Net P&L"
          value={fmtMoney(totalPnl)}
          tone={totalPnl >= 0 ? "win" : "loss"}
        />
        <MetricCard
          label="Growth"
          value={fmtPct(growth)}
          delta={growthSubline}
          tone={(growth ?? 0) >= 0 ? "win" : "loss"}
        />
      </div>

      {hasMonthActivity ? (
        <div className="text-center text-sm text-gold/70 py-2">
          This month: {pulse.winDays} win days · {pulse.lossDays} loss days · best{" "}
          <span className="text-win">+${pulse.bestDay.toFixed(0)}</span> · worst{" "}
          <span className="text-loss">-${Math.abs(pulse.worstDay).toFixed(0)}</span>
        </div>
      ) : null}

      {/* Open Positions Panel */}
      <OpenPositionsPanel accountId={activeId || null} />

      {/* Live open positions from followed traders */}
      <LiveFollowingStrip initial={followingOpenPositions} />

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
