"use client";

import { useRef, useState } from "react";
import { addManualTradeAction } from "@/lib/actions/manual-trade";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Props = {
  brokerAccountId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

type FieldName =
  | "symbol"
  | "lots"
  | "openPrice"
  | "closePrice"
  | "profit"
  | "openTime"
  | "closeTime";

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
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});

  // Refs for focusing/scrolling to the first invalid field.
  const refs: Record<FieldName, React.RefObject<HTMLElement | null>> = {
    symbol: useRef<HTMLElement>(null),
    lots: useRef<HTMLElement>(null),
    openPrice: useRef<HTMLElement>(null),
    closePrice: useRef<HTMLElement>(null),
    profit: useRef<HTMLElement>(null),
    openTime: useRef<HTMLElement>(null),
    closeTime: useRef<HTMLElement>(null),
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const nextErrors: Partial<Record<FieldName, string>> = {};
    if (!symbol.trim()) nextErrors.symbol = "Symbol is required.";
    if (!lots) nextErrors.lots = "Lots is required.";
    if (!openPrice) nextErrors.openPrice = "Open price is required.";
    if (!closePrice) nextErrors.closePrice = "Close price is required.";
    if (!profit) nextErrors.profit = "Profit is required.";
    if (!openTime) nextErrors.openTime = "Open time is required.";
    if (!closeTime) nextErrors.closeTime = "Close time is required.";

    // Lightweight consistency check: close cannot precede open.
    if (openTime && closeTime && closeTime < openTime) {
      nextErrors.closeTime = "Close time can't be before open time.";
    }

    setErrors(nextErrors);

    const order: FieldName[] = [
      "symbol",
      "lots",
      "openPrice",
      "closePrice",
      "profit",
      "openTime",
      "closeTime",
    ];
    const firstInvalid = order.find((k) => nextErrors[k]);
    if (firstInvalid) {
      const el = refs[firstInvalid].current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLElement & { focus?: () => void }).focus?.();
      }
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
    setSymbol(""); setType("Buy"); setLots(""); setOpenPrice(""); setClosePrice("");
    setOpenTime(""); setCloseTime(""); setSl(""); setTp(""); setProfit("");
    setNotes(""); setTags("");
    setErrors({});

    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
        <Field label="Symbol *" error={errors.symbol}>
          <Input
            ref={refs.symbol as React.RefObject<HTMLInputElement>}
            type="text"
            placeholder="EURUSD"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="text-white placeholder:text-muted"
          />
        </Field>

        <Field label="Type *">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as "Buy" | "Sell")}
            className="text-white"
          >
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
          </Select>
        </Field>

        <Field label="Lots *" error={errors.lots}>
          <Input
            ref={refs.lots as React.RefObject<HTMLInputElement>}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.10"
            value={lots}
            onChange={(e) => setLots(e.target.value)}
            className="text-white placeholder:text-muted"
          />
        </Field>

        <Field label="Open Price *" error={errors.openPrice}>
          <Input
            ref={refs.openPrice as React.RefObject<HTMLInputElement>}
            type="number"
            step="any"
            placeholder="1.12345"
            value={openPrice}
            onChange={(e) => setOpenPrice(e.target.value)}
            className="text-white placeholder:text-muted"
          />
        </Field>

        <Field label="Close Price *" error={errors.closePrice}>
          <Input
            ref={refs.closePrice as React.RefObject<HTMLInputElement>}
            type="number"
            step="any"
            placeholder="1.12500"
            value={closePrice}
            onChange={(e) => setClosePrice(e.target.value)}
            className="text-white placeholder:text-muted"
          />
        </Field>

        <Field label="Profit *" error={errors.profit}>
          <Input
            ref={refs.profit as React.RefObject<HTMLInputElement>}
            type="number"
            step="any"
            placeholder="25.50"
            value={profit}
            onChange={(e) => setProfit(e.target.value)}
            className="text-white placeholder:text-muted"
          />
        </Field>

        <Field label="Open Time *" error={errors.openTime}>
          <Input
            ref={refs.openTime as React.RefObject<HTMLInputElement>}
            type="datetime-local"
            value={openTime}
            onChange={(e) => setOpenTime(e.target.value)}
            className="text-white"
          />
        </Field>

        <Field label="Close Time *" error={errors.closeTime}>
          <Input
            ref={refs.closeTime as React.RefObject<HTMLInputElement>}
            type="datetime-local"
            value={closeTime}
            onChange={(e) => setCloseTime(e.target.value)}
            className="text-white"
          />
        </Field>

        <Field label="Stop Loss (optional)">
          <Input
            type="number"
            step="any"
            placeholder="1.12000"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            className="text-white placeholder:text-muted"
          />
        </Field>

        <Field label="Take Profit (optional)">
          <Input
            type="number"
            step="any"
            placeholder="1.13000"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            className="text-white placeholder:text-muted"
          />
        </Field>
      </div>

      <Field label="Tags (optional, comma-separated)">
        <Input
          type="text"
          placeholder="breakout, session-open"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="text-white placeholder:text-muted"
        />
      </Field>

      <Field label="Notes (optional)">
        <textarea
          rows={3}
          placeholder="Trade rationale, emotions, lessons learned…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full resize-none rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-gold/50 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
      </Field>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted">
          Manual trades are for personal journaling only and do not count toward leaderboard rankings.
        </p>
        <div className="flex shrink-0 gap-2">
          {onCancel ? (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Add Trade"}
          </Button>
        </div>
      </div>
    </form>
  );
}
