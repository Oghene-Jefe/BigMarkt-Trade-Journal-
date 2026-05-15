"use client";

import { useState, useEffect, useMemo, useRef, useActionState } from "react";
import Link from "next/link";
import type { TradeRow } from "@/lib/types";
import type { TradeActionState } from "@/app/(app)/actions";
import CompressedFileInput from "./CompressedFileInput";

type Props = {
  trade?: TradeRow;
  existingChartUrl?: string | null;
  action: (state: TradeActionState, fd: FormData) => Promise<TradeActionState>;
  submitLabel: string;
};

// Returns the contract-size multiplier for a given pair symbol.
// Forex default: 100000 units × 0.0001 pip value = ×10
function getPnlMultiplier(pair: string): number {
  const p = pair.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (p.startsWith("XAU")) return 100;
  if (p.startsWith("XAG")) return 5000;
  const cryptoPrefixes = ["BTC", "ETH", "XRP", "SOL", "ADA", "DOT", "LINK", "DOGE", "MATIC", "BNB", "LTC", "AVAX", "ATOM"];
  if (cryptoPrefixes.some((c) => p.startsWith(c))) return 1;
  if (/^(US30|NAS100|US500|UK100|GER40|DAX|SPX500|NDX|DOW|FTSE|CAC|NIKKEI)/.test(p)) return 1;
  return 10;
}

export default function TradeForm({ trade, existingChartUrl, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<TradeActionState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  // Controlled state for fields that drive live calculations.
  const [pair, setPair] = useState(trade?.pair ?? "");
  const [direction, setDirection] = useState<"BUY" | "SELL">(trade?.direction ?? "BUY");
  const [entry, setEntry] = useState(trade?.entry_price != null ? String(trade.entry_price) : "");
  const [exitP, setExitP] = useState(trade?.exit_price != null ? String(trade.exit_price) : "");
  const [stopLoss, setStopLoss] = useState(trade?.stop_loss != null ? String(trade.stop_loss) : "");
  const [lotSize, setLotSize] = useState(trade?.lot_size != null ? String(trade.lot_size) : "");
  const [pnl, setPnl] = useState(trade?.pnl != null ? String(trade.pnl) : "0");
  const [result, setResult] = useState<"WIN" | "LOSS" | "BE">(trade?.result ?? "WIN");

  // Only recalculate after the user has interacted — prevents clobbering stored
  // values on edit forms, and avoids React strict-mode double-invocation issues.
  const userInteracted = useRef(false);

  useEffect(() => {
    if (!userInteracted.current) return;
    const e = parseFloat(entry);
    const x = parseFloat(exitP);
    const l = parseFloat(lotSize);
    if (!isNaN(e) && !isNaN(x) && !isNaN(l) && l > 0 && pair.trim()) {
      const mult = getPnlMultiplier(pair);
      const sign = direction === "BUY" ? 1 : -1;
      const calculated = +(sign * (x - e) * l * mult).toFixed(2);
      setPnl(String(calculated));
      setResult(calculated > 0 ? "WIN" : calculated < 0 ? "LOSS" : "BE");
    }
  }, [entry, exitP, lotSize, direction, pair]);

  const rrValue = useMemo(() => {
    const e = parseFloat(entry);
    const x = parseFloat(exitP);
    const s = parseFloat(stopLoss);
    if (isNaN(e) || isNaN(x) || isNaN(s)) return null;
    const risk = Math.abs(e - s);
    if (risk === 0) return null;
    return +(Math.abs(x - e) / risk).toFixed(2);
  }, [entry, exitP, stopLoss]);

  function touch() {
    userInteracted.current = true;
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl bg-panel p-6" encType="multipart/form-data">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Pair <span className="text-loss">*</span></span>
          <input
            name="pair"
            required
            placeholder="EURUSD"
            value={pair}
            onChange={(e) => { touch(); setPair(e.target.value); }}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
          {fe.pair ? <span className="mt-1 block text-xs text-loss">{fe.pair}</span> : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Direction</span>
          <select
            name="direction"
            value={direction}
            onChange={(e) => { touch(); setDirection(e.target.value as "BUY" | "SELL"); }}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          {fe.direction ? <span className="mt-1 block text-xs text-loss">{fe.direction}</span> : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Result</span>
          <select
            name="result"
            value={result}
            onChange={(e) => setResult(e.target.value as "WIN" | "LOSS" | "BE")}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          >
            <option value="WIN">WIN</option>
            <option value="LOSS">LOSS</option>
            <option value="BE">BE</option>
          </select>
          {fe.result ? <span className="mt-1 block text-xs text-loss">{fe.result}</span> : null}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">P&amp;L ($)</span>
          <input
            name="pnl"
            type="number"
            step="0.01"
            value={pnl}
            onChange={(e) => {
              setPnl(e.target.value);
              const n = parseFloat(e.target.value);
              if (!isNaN(n)) setResult(n > 0 ? "WIN" : n < 0 ? "LOSS" : "BE");
            }}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
          {fe.pnl ? <span className="mt-1 block text-xs text-loss">{fe.pnl}</span> : null}
        </label>

        <div className="block text-sm">
          <span className="mb-1 block text-muted">R:R Ratio</span>
          <div className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-white">
            {rrValue ?? "—"}
          </div>
          <span className="mt-1 block text-gray-400 text-xs italic">Auto-calculated from entry, exit &amp; stop loss</span>
          {rrValue != null ? <input type="hidden" name="rr_ratio" value={rrValue} /> : null}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Lot size</span>
          <input
            name="lot_size"
            type="number"
            step="any"
            value={lotSize}
            onChange={(e) => { touch(); setLotSize(e.target.value); }}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
          {fe.lot_size ? <span className="mt-1 block text-xs text-loss">{fe.lot_size}</span> : null}
        </label>

        <Field label="Setup grade" name="setup_grade" defaultValue={trade?.setup_grade ?? ""} placeholder="A / B / C" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Entry</span>
          <input
            name="entry_price"
            type="number"
            step="any"
            value={entry}
            onChange={(e) => { touch(); setEntry(e.target.value); }}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
          {fe.entry_price ? <span className="mt-1 block text-xs text-loss">{fe.entry_price}</span> : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Exit</span>
          <input
            name="exit_price"
            type="number"
            step="any"
            value={exitP}
            onChange={(e) => { touch(); setExitP(e.target.value); }}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
          {fe.exit_price ? <span className="mt-1 block text-xs text-loss">{fe.exit_price}</span> : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Stop loss</span>
          <input
            name="stop_loss"
            type="number"
            step="any"
            value={stopLoss}
            onChange={(e) => { touch(); setStopLoss(e.target.value); }}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
          {fe.stop_loss ? <span className="mt-1 block text-xs text-loss">{fe.stop_loss}</span> : null}
        </label>

        <Field label="Take profit" name="take_profit" type="number" step="any" defaultValue={trade?.take_profit ?? ""} error={fe.take_profit} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Session" name="session" defaultValue={trade?.session ?? ""} placeholder="London / NY / Asia" />
        <Field label="Emotions" name="emotions" defaultValue={trade?.emotions ?? ""} placeholder="Calm / FOMO / Tilt" />
        <Field label="Strategy" name="strategy" defaultValue={trade?.strategy ?? ""} placeholder="Breakout / Reversal" />
      </div>

      <Field label="Tags (comma-separated)" name="tags" defaultValue={trade?.tags ?? ""} placeholder="breakout, news" />

      <div className="space-y-2">
        <span className="block text-sm text-muted">Chart screenshot</span>
        {existingChartUrl ? (
          <div className="space-y-2">
            <a href={existingChartUrl} target="_blank" rel="noreferrer" className="inline-block">
              <img src={existingChartUrl} alt="Current chart" className="max-h-40 rounded-md border border-white/10" />
            </a>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="remove_chart" value="1" />
              Remove current chart on save
            </label>
          </div>
        ) : null}
        <CompressedFileInput
          name="chart"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-gold/20 file:px-3 file:py-1.5 file:text-xs file:font-display file:tracking-widest file:text-gold hover:file:bg-gold/30"
        />
        <p className="text-xs text-muted">Auto-compressed to ≤1600px, JPEG q82. Server cap 5 MB. Visible only to you unless trade visibility is public.</p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Notes</span>
        <textarea
          name="notes"
          rows={4}
          defaultValue={trade?.notes ?? ""}
          maxLength={4000}
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
        />
        {fe.notes ? <span className="mt-1 block text-xs text-loss">{fe.notes}</span> : null}
      </label>

      <Select
        label="Visibility"
        name="visibility"
        defaultValue={trade?.visibility ?? "private"}
        options={["private", "public", "exclude"]}
        hint="private = only you · public = on your share page · exclude = hide from analytics & leaderboard"
      />

      {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link href="/journal" className="rounded-md border border-white/20 px-4 py-2 text-sm">Cancel</Link>
        <button
          disabled={pending}
          className="rounded-md bg-gold px-6 py-2 font-display tracking-widest text-black disabled:opacity-50"
        >
          {pending ? "SAVING…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field(props: {
  label: string; name: string; type?: string; step?: string;
  required?: boolean; placeholder?: string; defaultValue?: string | number | null;
  error?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        step={props.step}
        required={props.required}
        placeholder={props.placeholder}
        defaultValue={props.defaultValue ?? ""}
        className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
      />
      {props.error ? <span className="mt-1 block text-xs text-loss">{props.error}</span> : null}
    </label>
  );
}

function Select(props: {
  label: string; name: string; defaultValue: string; options: string[];
  error?: string; hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{props.label}</span>
      <select
        name={props.name}
        defaultValue={props.defaultValue}
        className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
      >
        {props.options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {props.hint ? <span className="mt-1 block text-xs text-muted">{props.hint}</span> : null}
      {props.error ? <span className="mt-1 block text-xs text-loss">{props.error}</span> : null}
    </label>
  );
}
