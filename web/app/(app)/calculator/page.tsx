"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { INSTRUMENTS, ALL_INSTRUMENTS } from "@/lib/pip-values";

const MIN_LOT = 0.01;

export default function CalculatorPage() {
  const [balance, setBalance] = useState<string>("10000");
  const [riskPct, setRiskPct] = useState<string>("1");
  const [symbol, setSymbol] = useState<string>("XAU/USD");
  const [entry, setEntry] = useState<string>("");
  const [stop, setStop] = useState<string>("");

  const instrument = useMemo(
    () => ALL_INSTRUMENTS.find((i) => i.symbol === symbol) ?? ALL_INSTRUMENTS[0],
    [symbol],
  );

  const calc = useMemo(() => {
    const bal = parseFloat(balance);
    const risk = parseFloat(riskPct);
    const e = parseFloat(entry);
    const s = parseFloat(stop);

    if (!isFinite(bal) || bal <= 0 || !isFinite(risk) || risk <= 0 || !isFinite(e) || !isFinite(s) || e === s) {
      return null;
    }

    const slDist = Math.abs(e - s) * instrument.pipFactor;
    if (slDist <= 0) return null;

    const riskAmt = (bal * risk) / 100;
    const rawLot = riskAmt / (slDist * instrument.pipValue);
    const lot = Math.round(Math.max(MIN_LOT, Math.min(rawLot, 999)) / 0.01) * 0.01;
    const pipValueAtLot = instrument.pipValue * lot;
    const maxLoss = slDist * instrument.pipValue * lot;
    const minLotCost = slDist * instrument.pipValue * MIN_LOT;
    const feasible = rawLot >= MIN_LOT;

    return { riskAmt, rawLot, lot, slDist, pipValueAtLot, maxLoss, minLotCost, feasible };
  }, [balance, riskPct, entry, stop, instrument]);

  const riskTooHigh = parseFloat(riskPct) > 5;
  const lotTooSmall = calc !== null && !calc.feasible;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Risk calculator</h1>
        <p className="mt-1 text-sm text-muted">
          Position sizing for your account. Live updates as you type.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Inputs */}
        <div className="rounded-lg border border-white/10 bg-panel p-4 space-y-4">
          <h2 className="text-sm font-medium text-white">Inputs</h2>

          <Field label="Account Balance (USD)">
            <input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className={inputCls}
              placeholder="10000"
            />
          </Field>

          <Field label="Risk Percentage (%)">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              className={inputCls}
              placeholder="1"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[0.5, 1, 2, 3].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setRiskPct(String(p))}
                  className="rounded-md border border-white/15 px-3 py-1 text-xs text-muted hover:border-gold hover:text-gold"
                >
                  {p}%
                </button>
              ))}
            </div>
          </Field>

          <Field label="Instrument">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className={inputCls}
            >
              {Object.entries(INSTRUMENTS).map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((i) => (
                    <option key={i.symbol} value={i.symbol}>
                      {i.symbol}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted">{instrument.hint}</p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Entry Price">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Stop Loss Price">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={stop}
                onChange={(e) => setStop(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* Outputs */}
        <div className="rounded-lg border border-white/10 bg-panel p-4 space-y-4">
          <h2 className="text-sm font-medium text-white">Result</h2>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Recommended lot size</div>
            <div
              className="text-5xl font-semibold tabular-nums"
              style={{ color: lotTooSmall ? "#EF4444" : "#D4AF37" }}
            >
              {calc ? (lotTooSmall ? "—" : calc.lot.toFixed(2)) : "—"}
            </div>
            <div className="text-xs text-muted">
              {calc
                ? lotTooSmall
                  ? "Setup not feasible within risk budget"
                  : `${parseFloat(riskPct)}% of $${Number(balance).toLocaleString()} on ${instrument.symbol}`
                : "Fill in all fields to calculate"}
            </div>
          </div>

          {calc && !lotTooSmall ? (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Risk Amount" value={`$${calc.riskAmt.toFixed(2)}`} />
              <Stat label="Pip Value" value={`$${calc.pipValueAtLot.toFixed(2)}/${instrument.unit === "pips" ? "pip" : "pt"}`} />
              <Stat label="SL Distance" value={`${calc.slDist.toFixed(instrument.unit === "points" ? 0 : 1)} ${instrument.unit}`} />
              <Stat label="Max Loss" value={`$${calc.maxLoss.toFixed(2)}`} />
            </div>
          ) : null}

          {riskTooHigh ? (
            <Warning tone="danger" title="HIGH RISK">
              You are risking <strong>{riskPct}%</strong> per trade. Anything above 5% is considered
              dangerous — a small losing streak can wipe out your account.
            </Warning>
          ) : null}

          {lotTooSmall && calc ? (
            <Warning tone="danger" title="LOT SIZE BELOW BROKER MINIMUM (0.01)">
              Your {parseFloat(riskPct)}% budget is <strong>${calc.riskAmt.toFixed(2)}</strong>, but
              0.01 lot on {instrument.symbol} at {calc.slDist.toFixed(1)} {instrument.unit} SL costs{" "}
              <strong>${calc.minLotCost.toFixed(2)}</strong>. Tighten the SL, grow the account, or
              switch to a smaller-pip instrument.
            </Warning>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-gold";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest text-muted">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
      <div className="font-mono text-lg text-white">{value}</div>
    </div>
  );
}

function Warning({
  tone,
  title,
  children,
}: {
  tone: "danger" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const color = tone === "danger" ? "rgba(239,68,68" : "rgba(212,175,55";
  return (
    <div
      className="rounded-md border p-3 text-sm"
      style={{
        background: `${color},0.1)`,
        borderColor: `${color},0.4)`,
        color: "#fff",
      }}
    >
      <div
        className="flex items-center gap-2 text-sm font-medium"
        style={{ color: tone === "danger" ? "#EF4444" : "#D4AF37" }}
      >
        <AlertTriangle size={14} aria-hidden />
        <span>{title}</span>
      </div>
      <div className="mt-1 text-xs text-muted">{children}</div>
    </div>
  );
}
