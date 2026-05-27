"use client";

import { useState } from "react";
import { addManualTradeAction } from "@/lib/actions/manual-trade";

type Props = {
  brokerAccountId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export default function ManualTradeForm({ brokerAccountId, onSuccess, onCancel }: Props) {
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState<"Buy" | "Sell">("Buy");
  const [lots, setLots] = useState("");
  const [openPrice, setOpenPrice] = useState("");
  const [closePrice, setClosePrice] = useState("");
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [profit, setProfit] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!symbol.trim() || !lots || !openPrice || !closePrice || !openTime || !closeTime || !profit) {
      setError("Please fill in all required fields.");
      return;
    }

    setPending(true);
    const result = await addManualTradeAction({
      brokerAccountId,
      symbol: symbol.toUpperCase().trim(),
      type,
      lots: parseFloat(lots),
      openPrice: parseFloat(openPrice),
      closePrice: parseFloat(closePrice),
      openTime,
      closeTime,
      sl: sl ? parseFloat(sl) : null,
      tp: tp ? parseFloat(tp) : null,
      profit: parseFloat(profit),
      notes: notes || null,
      tags: tags || null,
    });
    setPending(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSuccessMsg("Trade added to your journal");
    // Reset form
    setSymbol(""); setType("Buy"); setLots(""); setOpenPrice(""); setClosePrice("");
    setOpenTime(""); setCloseTime(""); setSl(""); setTp(""); setProfit("");
    setNotes(""); setTags("");

    onSuccess?.();
  }

  const inputCls =
    "w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-gold/50 focus:outline-none";
  const labelCls = "block text-xs text-muted mb-1";
  const required = <span className="text-loss">*</span>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {successMsg ? (
        <div className="rounded-md border border-win/30 bg-win/10 px-4 py-2 text-sm text-win">
          {successMsg}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-loss/30 bg-loss/10 px-4 py-2 text-sm text-loss">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Symbol */}
        <label className="block">
          <span className={labelCls}>Symbol {required}</span>
          <input
            type="text"
            placeholder="EURUSD"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className={inputCls}
            required
          />
        </label>

        {/* Type */}
        <label className="block">
          <span className={labelCls}>Type {required}</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "Buy" | "Sell")}
            className={inputCls}
          >
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
          </select>
        </label>

        {/* Lots */}
        <label className="block">
          <span className={labelCls}>Lots {required}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.10"
            value={lots}
            onChange={(e) => setLots(e.target.value)}
            className={inputCls}
            required
          />
        </label>

        {/* Open Price */}
        <label className="block">
          <span className={labelCls}>Open Price {required}</span>
          <input
            type="number"
            step="any"
            placeholder="1.12345"
            value={openPrice}
            onChange={(e) => setOpenPrice(e.target.value)}
            className={inputCls}
            required
          />
        </label>

        {/* Close Price */}
        <label className="block">
          <span className={labelCls}>Close Price {required}</span>
          <input
            type="number"
            step="any"
            placeholder="1.12500"
            value={closePrice}
            onChange={(e) => setClosePrice(e.target.value)}
            className={inputCls}
            required
          />
        </label>

        {/* Profit */}
        <label className="block">
          <span className={labelCls}>Profit {required}</span>
          <input
            type="number"
            step="any"
            placeholder="25.50"
            value={profit}
            onChange={(e) => setProfit(e.target.value)}
            className={inputCls}
            required
          />
        </label>

        {/* Open Time */}
        <label className="block">
          <span className={labelCls}>Open Time {required}</span>
          <input
            type="datetime-local"
            value={openTime}
            onChange={(e) => setOpenTime(e.target.value)}
            className={inputCls}
            required
          />
        </label>

        {/* Close Time */}
        <label className="block">
          <span className={labelCls}>Close Time {required}</span>
          <input
            type="datetime-local"
            value={closeTime}
            onChange={(e) => setCloseTime(e.target.value)}
            className={inputCls}
            required
          />
        </label>

        {/* SL (optional) */}
        <label className="block">
          <span className={labelCls}>Stop Loss <span className="text-muted/60">(optional)</span></span>
          <input
            type="number"
            step="any"
            placeholder="1.12000"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            className={inputCls}
          />
        </label>

        {/* TP (optional) */}
        <label className="block">
          <span className={labelCls}>Take Profit <span className="text-muted/60">(optional)</span></span>
          <input
            type="number"
            step="any"
            placeholder="1.13000"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      {/* Tags */}
      <label className="block">
        <span className={labelCls}>Tags <span className="text-muted/60">(optional, comma-separated)</span></span>
        <input
          type="text"
          placeholder="breakout, session-open"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className={inputCls}
        />
      </label>

      {/* Notes */}
      <label className="block">
        <span className={labelCls}>Notes <span className="text-muted/60">(optional)</span></span>
        <textarea
          rows={3}
          placeholder="Trade rationale, emotions, lessons learned…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${inputCls} resize-none`}
        />
      </label>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted">
          Manual trades are for personal journaling only and do not count toward leaderboard rankings.
        </p>
        <div className="flex shrink-0 gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-white/10 px-4 py-2 text-sm text-muted hover:bg-white/5"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold/90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Add Trade"}
          </button>
        </div>
      </div>
    </form>
  );
}
