"use client";

import { forwardRef } from "react";
import type { TradeRow } from "@/lib/types";
import { buildMonthlyStats } from "@/lib/reportCard";

interface MonthlyReportCardProps {
  trades: TradeRow[];
  username: string;
  year: number;
  month: number;
}

const GOLD = "#D4AF37";
const GREEN = "#22c55e";
const RED = "#ef4444";
const WHITE = "#f5f5f5";
const MUTED = "#a3a3a3";
const BG = "#0a0a0a";

const fmtMoney = (n: number): string =>
  `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;

const MonthlyReportCard = forwardRef<HTMLDivElement, MonthlyReportCardProps>(
  function MonthlyReportCard({ trades, username, year, month }, ref) {
    const s = buildMonthlyStats(trades, year, month);
    const pnlColor = s.totalPnl >= 0 ? GREEN : RED;

    return (
      <div
        ref={ref}
        style={{
          backgroundColor: BG,
          border: `1px solid ${GOLD}66`,
          borderRadius: 16,
          padding: 24,
          minWidth: 480,
          color: WHITE,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/bigmarkt-logo.png" alt="BigMarkt" style={{ height: 24 }} />
          <span style={{ color: GOLD, fontSize: 14, fontWeight: 600 }}>@{username}</span>
        </div>
        <div style={{ height: 1, backgroundColor: `${GOLD}66`, margin: "12px 0 16px" }} />

        <div style={{ marginBottom: 20 }}>
          <div style={{ color: GOLD, fontSize: 22, fontWeight: 700, letterSpacing: "0.18em" }}>
            MONTHLY REPORT
          </div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{s.monthLabel}</div>
        </div>

        <Row3>
          <Stat label="Net P&L" value={fmtMoney(s.totalPnl)} color={pnlColor} big />
          <Stat label="Win Rate" value={`${s.winRate.toFixed(0)}%`} color={GOLD} big />
          <Stat label="Total Trades" value={String(s.totalTrades)} color={WHITE} big />
        </Row3>

        <Divider />

        <Row3>
          <Stat label="Wins" value={String(s.wins)} color={GREEN} />
          <Stat label="Losses" value={String(s.losses)} color={RED} />
          <Stat label="Breakeven" value={String(s.breakeven)} color={GOLD} />
        </Row3>

        <Divider />

        <Row2>
          <Stat label="Win Days" value={`${s.winDays} days`} color={GREEN} />
          <Stat label="Loss Days" value={`${s.lossDays} days`} color={RED} />
        </Row2>

        <Divider />

        <Row2>
          <Stat
            label="Best Trade"
            value={s.bestTrade ? `${s.bestTrade.pair} ${fmtMoney(s.bestTrade.pnl)}` : "—"}
            color={GREEN}
          />
          <Stat label="Best Day" value={`+$${s.bestDay.toFixed(0)}`} color={GREEN} />
        </Row2>

        <Row2>
          <Stat
            label="Worst Trade"
            value={s.worstTrade ? `${s.worstTrade.pair} ${fmtMoney(s.worstTrade.pnl)}` : "—"}
            color={RED}
          />
          <Stat label="Worst Day" value={`-$${Math.abs(s.worstDay).toFixed(0)}`} color={RED} />
        </Row2>

        <Divider />

        <Row3>
          <Stat label="Avg R:R" value={s.avgRR != null ? s.avgRR.toFixed(2) : "—"} color={WHITE} />
          <Stat label="Top Pair" value={s.mostTradedPair ?? "—"} color={WHITE} />
          <Stat label="Consistency" value={`${s.consistency.toFixed(0)}%`} color={GOLD} />
        </Row3>

        <div style={{ height: 1, backgroundColor: `${GOLD}66`, margin: "20px 0 12px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED }}>
          <span>{s.monthLabel}</span>
          <span>journal.bigmarkt.co/{username}</span>
        </div>
      </div>
    );
  },
);

export default MonthlyReportCard;

function Row3({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
      {children}
    </div>
  );
}
function Row2({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
      {children}
    </div>
  );
}
function Divider() {
  return <div style={{ height: 1, backgroundColor: "#1f1f1f", margin: "16px 0" }} />;
}
function Stat({
  label,
  value,
  color,
  big = false,
}: {
  label: string;
  value: string;
  color: string;
  big?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          color,
          fontSize: big ? 24 : 16,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}
