import { forwardRef } from "react";
import Logo from "@/components/ui/Logo";

export interface TradeCardProps {
  pair: string;
  direction: "BUY" | "SELL";
  result: "WIN" | "LOSS" | "BREAKEVEN";
  pnl: number;
  rrRatio: string | null;
  lotSize: number | null;
  setupGrade: string | null;
  entry: number | null;
  exit: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  session: string | null;
  strategy: string | null;
  emotions: string | null;
  tags: string[] | null;
  username: string;
  profileUrl: string;
  createdAt: string;
  id?: string;
}

const GOLD = "#D4AF37";
const WIN = "#22C55E";
const LOSS = "#EF4444";
const BREAKEVEN = "#9CA3AF";
const DARK = "#0a0a0a";
const PANEL = "#141414";
const MUTED = "#888888";

function resultColor(r: TradeCardProps["result"]) {
  return r === "WIN" ? WIN : r === "LOSS" ? LOSS : BREAKEVEN;
}

function resultIcon(r: TradeCardProps["result"]) {
  return r === "WIN" ? "✅" : r === "LOSS" ? "❌" : "➖";
}

function directionColor(d: TradeCardProps["direction"]) {
  return d === "BUY" ? "#3B82F6" : "#EF4444";
}

function fmtPrice(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const TradeCard = forwardRef<HTMLDivElement, TradeCardProps>(function TradeCard(props, ref) {
  const {
    pair, direction, result, pnl, rrRatio, lotSize, setupGrade,
    entry, exit, stopLoss, takeProfit, session, strategy, emotions, tags,
    username, profileUrl, createdAt, id,
  } = props;

  const rColor = resultColor(result);
  const dColor = directionColor(direction);
  const pnlColor = pnl > 0 ? WIN : pnl < 0 ? LOSS : BREAKEVEN;
  const pnlPrefix = pnl > 0 ? "+" : "";

  return (
    <div
      ref={ref}
      id={id}
      style={{ backgroundColor: DARK, borderColor: `${GOLD}33` }}
      className="w-full rounded-2xl border p-6 text-white"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <Logo size="sm" />
        <span className="text-sm font-mono" style={{ color: GOLD }}>
          @{username}
        </span>
      </div>

      {/* HERO */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h2
          className="font-display text-4xl tracking-widest"
          style={{ color: GOLD }}
        >
          {pair.toUpperCase()}
        </h2>
        <span
          className="rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider"
          style={{ backgroundColor: `${dColor}22`, color: dColor, border: `1px solid ${dColor}55` }}
        >
          {direction}
        </span>
        <span
          className="rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider"
          style={{ backgroundColor: `${rColor}22`, color: rColor, border: `1px solid ${rColor}55` }}
        >
          {resultIcon(result)} {result}
        </span>
      </div>

      {/* PRICES */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PriceCell label="Entry" value={fmtPrice(entry)} />
        <PriceCell label="Exit" value={fmtPrice(exit)} />
        <PriceCell label="Stop Loss" value={fmtPrice(stopLoss)} />
        <PriceCell label="Take Profit" value={fmtPrice(takeProfit)} />
      </div>

      {/* STATS */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCell
          label="P&L"
          value={`${pnlPrefix}${pnl.toFixed(2)}`}
          color={pnlColor}
        />
        <StatCell label="R:R Ratio" value={rrRatio ?? "—"} />
        <StatCell label="Lot Size" value={lotSize != null ? lotSize.toFixed(2) : "—"} />
        <StatCell label="Setup Grade" value={setupGrade ?? "—"} />
      </div>

      {/* SESSION */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ContextCell label="Session" value={session ?? "—"} />
        <ContextCell label="Strategy" value={strategy ?? "—"} />
        <ContextCell label="Emotions" value={emotions ?? "—"} />
      </div>

      {/* TAGS */}
      {tags && tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider"
              style={{ color: GOLD, border: `1px solid ${GOLD}66` }}
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {/* FOOTER */}
      <div
        className="mt-6 flex items-center justify-between border-t pt-3 text-[11px]"
        style={{ borderColor: `${GOLD}33` }}
      >
        <span style={{ color: MUTED }}>{fmtDate(createdAt)}</span>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: `${GOLD}AA`, textDecoration: "none" }}
          className="font-mono tracking-wide hover:underline"
        >
          journal.bigmarkt.co/{username}
        </a>
      </div>
    </div>
  );
});

export default TradeCard;

function PriceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md p-2.5" style={{ backgroundColor: PANEL }}>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-base" style={{ color: GOLD }}>
        {value}
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md p-2.5" style={{ backgroundColor: PANEL }}>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-base" style={{ color: color ?? "#FFFFFF" }}>
        {value}
      </div>
    </div>
  );
}

function ContextCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md p-2.5" style={{ backgroundColor: PANEL }}>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="mt-0.5 text-sm text-white">{value}</div>
    </div>
  );
}
