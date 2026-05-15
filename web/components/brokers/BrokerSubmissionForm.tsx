"use client";

import { useState, useTransition } from "react";
import { submitBrokerAction } from "@/actions/brokers";

export default function BrokerSubmissionForm() {
  const [open, setOpen] = useState(false);
  const [brokerName, setBrokerName] = useState("");
  const [platform, setPlatform] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);
    startTransition(async () => {
      const res = await submitBrokerAction({
        brokerName,
        platform,
        website: website || undefined,
        notes: notes || undefined,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk(true);
      setBrokerName("");
      setPlatform("");
      setWebsite("");
      setNotes("");
    });
  }

  return (
    <section className="rounded-lg border border-white/10 bg-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-sm font-medium text-white">
          SUBMIT A BROKER
        </span>
        <span className="text-xs text-muted">{open ? "▲ Hide" : "▼ Open"}</span>
      </button>

      {open ? (
        <form onSubmit={handleSubmit} className="space-y-4 border-t border-white/10 p-6">
          <p className="text-xs text-muted">
            Don't see your broker? Tell us about it and we'll review it for
            inclusion.
          </p>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Broker name *</span>
            <input
              required
              maxLength={80}
              value={brokerName}
              onChange={(e) => setBrokerName(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Platform *</span>
            <input
              required
              maxLength={80}
              placeholder="e.g. MT4, MT5, WebSocket API"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Website</span>
            <input
              type="url"
              maxLength={200}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Notes</span>
            <textarea
              rows={4}
              maxLength={1000}
              placeholder="Any details about API access or restrictions"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
            />
          </label>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          {ok ? (
            <p className="text-sm text-emerald-400">
              Submitted — thanks! We'll review and update the list.
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-gold px-5 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {pending ? "SUBMITTING…" : "SUBMIT"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
