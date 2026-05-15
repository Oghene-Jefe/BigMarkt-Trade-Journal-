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
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel shadow-2xl">
        <header className="border-b border-white/10 p-5">
          <h2
            id="tos-title"
            className="font-display text-xl tracking-widest text-gold"
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
              <span className="font-semibold text-white">EA is read-only.</span>{" "}
              Our MT4/MT5 EA never calls{" "}
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
              </code>
              . It only reads your trade history. It cannot place, modify, or
              close trades on your behalf.
            </li>
            <li>
              <span className="font-semibold text-white">
                Broker compliance is your responsibility.
              </span>{" "}
              You confirm that running a read-only EA does not violate your
              broker's terms of service. Some brokers and prop firms require
              prior approval — check before you install.
            </li>
            <li>
              <span className="font-semibold text-white">
                Prop firm accounts are journal-only.
              </span>{" "}
              For any prop firm account connected to BigMarkt, copy-trading
              execution is permanently disabled. Prop firm trades will be
              displayed in your journal but will never be copied to followers.
            </li>
            <li>
              <span className="font-semibold text-white">
                API keys are read-only and encrypted.
              </span>{" "}
              Exchange API keys must be created with read-only / view
              permissions and no withdrawal rights. We validate this on
              connection and reject keys with execution scope. Keys are
              encrypted at rest with per-row salts.
            </li>
            <li>
              <span className="font-semibold text-white">
                Follower lot sizes never match leader lot sizes.
              </span>{" "}
              Copy-trading (where available) scales every position to the
              follower's account size and risk settings. A follower's lot size
              is computed independently and will not equal the leader's lot
              size.
            </li>
            <li>
              <span className="font-semibold text-white">
                BigMarkt is a journaling tool, not a financial advisor.
              </span>{" "}
              Nothing on this platform is investment advice. Trade at your own
              risk. Past performance does not predict future results.
            </li>
          </ol>

          <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-300">
              Prop firm users — read this
            </p>
            <p className="mt-2 text-xs leading-relaxed text-orange-100/90">
              If your account is a prop firm challenge or funded account, copy
              execution is permanently disabled on it. Your trades will appear
              in your journal and on your public profile, but they will not be
              copied to followers under any circumstances. This is enforced
              server-side and cannot be turned on later.
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
              className="rounded-md bg-gold px-4 py-2 font-display text-sm tracking-widest text-black disabled:opacity-50"
            >
              {pending ? "SAVING…" : "ACCEPT"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
