"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { TradeRow } from "@/lib/types";
import type { TradeActionState } from "@/app/(app)/actions";

type Props = {
  trade?: TradeRow;
  existingChartUrl?: string | null;
  action: (state: TradeActionState, fd: FormData) => Promise<TradeActionState>;
  submitLabel: string;
};

export default function TradeForm({ trade, existingChartUrl, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<TradeActionState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4 rounded-2xl bg-panel p-6" encType="multipart/form-data">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Pair" name="pair" required defaultValue={trade?.pair ?? ""} placeholder="EURUSD" error={fe.pair} />
        <Select label="Direction" name="direction" defaultValue={trade?.direction ?? "BUY"} options={["BUY", "SELL"]} error={fe.direction} />
        <Select label="Result" name="result" defaultValue={trade?.result ?? "WIN"} options={["WIN", "LOSS", "BE"]} error={fe.result} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="P&L ($)" name="pnl" type="number" step="0.01" defaultValue={trade?.pnl ?? 0} error={fe.pnl} />
        <Field label="R:R" name="rr_ratio" type="number" step="0.01" defaultValue={trade?.rr_ratio ?? ""} error={fe.rr_ratio} />
        <Field label="Lot size" name="lot_size" type="number" step="any" defaultValue={trade?.lot_size ?? ""} error={fe.lot_size} />
        <Field label="Setup grade" name="setup_grade" defaultValue={trade?.setup_grade ?? ""} placeholder="A / B / C" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="Entry" name="entry_price" type="number" step="any" defaultValue={trade?.entry_price ?? ""} error={fe.entry_price} />
        <Field label="Exit" name="exit_price" type="number" step="any" defaultValue={trade?.exit_price ?? ""} error={fe.exit_price} />
        <Field label="Stop loss" name="stop_loss" type="number" step="any" defaultValue={trade?.stop_loss ?? ""} error={fe.stop_loss} />
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
        <input
          type="file"
          name="chart"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-gold/20 file:px-3 file:py-1.5 file:text-xs file:font-display file:tracking-widest file:text-gold hover:file:bg-gold/30"
        />
        <p className="text-xs text-muted">Max 5 MB. JPEG / PNG / WebP / GIF. Visible only to you unless trade visibility is public.</p>
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
