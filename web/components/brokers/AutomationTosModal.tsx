"use client";

import { useState, useTransition } from "react";
import { acceptAutomationTosAction } from "@/actions/tos";

export default function AutomationTosModal({
  onAccepted,
  onCancel,
}: {
  onAccepted: () => void;
  onCancel: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptAutomationTosAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      onAccepted();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tos-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-white/10 bg-panel shadow-2xl">
        <header className="border-b border-white/10 p-5">
          <h2
            id="tos-title"
            className="text-sm font-medium text-white"
          >
            Automated Journal — Terms of Use
          </h2>
          <p className="mt-1 text-xs text-muted">
            Please read carefully before connecting an EA or exchange API.
          </p>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <ol className="space-y-3 text-white/85">
            <li>
              <span className="font-semibold text-white">Read-only by design.</span>{" "}
              The EA only reads your trade history and reports it to your journal.
              It never places, modifies, or closes trades — no{" "}
              <code className="rounded bg-black/40 px-1 font-mono text-xs">
                OrderSend
              </code>
              ,{" "}
              <code className="rounded bg-black/40 px-1 font-mono text-xs">
                OrderModify
              </code>
              , or{" "}
              <code className="rounded bg-black/40 px-1 font-mono text-xs">
                OrderClose
              </code>{" "}
              calls, ever.
            </li>
            <li>
              <span className="font-semibold text-white">
                Broker &amp; prop firm compliance is your responsibility.
              </span>{" "}
              Some brokers and prop firms require approval for any third-party EA,
              even read-only ones. Check your account's terms before installing.
            </li>
            <li>
              <span className="font-semibold text-white">
                Your connection token is read-only.
              </span>{" "}
              It authorises journaling only and carries no trading, transfer, or
              withdrawal permissions.
            </li>
            <li>
              <span className="font-semibold text-white">Not financial advice.</span>{" "}
              BigMarkt is a journaling and trade-verification tool. Nothing here is
              investment advice. Trade at your own risk; past performance does not
              predict future results.
            </li>
          </ol>

          <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-300">
              Prop firm / funded accounts
            </p>
            <p className="mt-2 text-xs leading-relaxed text-orange-100/90">
              The EA only logs your trades — it executes nothing. Confirm your firm
              permits third-party journaling tools before connecting. Your trades
              appear in your journal, and on your public profile only if you choose
              to make it public.
            </p>
          </div>
        </div>

        <footer className="space-y-3 border-t border-white/10 p-5">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
            />
            <span>
              I have read and agree to these terms. I understand my broker's
              rules are my responsibility.
            </span>
          </label>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-md border border-white/10 bg-black/40 px-4 py-2 text-sm hover:border-white/30 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={!agreed || pending}
              className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {pending ? "Saving…" : "Accept"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
