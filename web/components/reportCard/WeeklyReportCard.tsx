"use client";

import { forwardRef } from "react";
import type { TradeRow } from "@/lib/types";
import { buildWeeklyStats } from "@/lib/reportCard";

interface WeeklyReportCardProps {
  trades: TradeRow[];
  username: string;
}

const GOLD = "#D4AF37";
const GREEN = "#22c55e";
const RED = "#ef4444";
const WHITE = "#f5f5f5";
const MUTED = "#a3a3a3";
const BG = "#0a0a0a";

const fmtMoney = (n: number): string =>
  `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;

const WeeklyReportCard = forwardRef<HTMLDivElement, WeeklyReportCardProps>(
  function WeeklyReportCard({ trades, username }, ref) {
    const s = buildWeeklyStats(trades);
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
            WEEKLY REPORT
          </div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
            {s.startDate} — {s.endDate}
          </div>
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
          <Stat
            label="Best Trade"
            value={s.bestTrade ? `${s.bestTrade.pair} ${fmtMoney(s.bestTrade.pnl)}` : "—"}
            color={GREEN}
          />
          <Stat
            label="Worst Trade"
            value={s.worstTrade ? `${s.worstTrade.pair} ${fmtMoney(s.worstTrade.pnl)}` : "—"}
            color={RED}
          />
        </Row2>

        <Divider />

        <Row3>
          <Stat label="Avg R:R" value={s.avgRR != null ? s.avgRR.toFixed(2) : "—"} color={WHITE} />
          <Stat label="Top Pair" value={s.mostTradedPair ?? "—"} color={WHITE} />
          <Stat label="Avg / Day" value={s.avgTradesPerDay.toFixed(1)} color={WHITE} />
        </Row3>

        <div style={{ height: 1, backgroundColor: `${GOLD}66`, margin: "20px 0 12px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED }}>
          <span>Week of {s.startDate}</span>
          <span>journal.bigmarkt.co/{username}</span>
        </div>
      </div>
    );
  },
);

export default WeeklyReportCard;

function Row3({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
      {children}
    </div>
  );
}
function Row2({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
