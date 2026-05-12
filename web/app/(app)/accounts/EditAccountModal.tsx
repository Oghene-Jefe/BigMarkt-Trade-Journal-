"use client";

import { useState, useTransition } from "react";
import type { BrokerAccount } from "@/lib/types";
import { updateBrokerAccountAction } from "./actions";

type AccountType = "live" | "demo" | "prop_firm";
type JournalMode = "manual" | "automated";

export default function EditAccountModal({ account }: { account: BrokerAccount }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(account.label);
  const [accountType, setAccountType] = useState<AccountType>(account.account_type);
  const [journalMode, setJournalMode] = useState<JournalMode>(account.journal_mode);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const locked = accountType === "prop_firm" || accountType === "demo";
  const effectiveMode: JournalMode = locked ? "manual" : journalMode;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("journal_mode", effectiveMode);
    startTransition(async () => {
      const res = await updateBrokerAccountAction(fd);
      if (res && "error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/10 bg-gray-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Edit Broker Account</h2>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white">✕</button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <input type="hidden" name="id" value={account.id} />

              <div>
                <label className="mb-1 block text-sm text-white/80">Label</label>
                <input
                  name="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Account Type</label>
                <select
                  name="account_type"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as AccountType)}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="live">🟢 Live</option>
                  <option value="demo">🔵 Demo</option>
                  <option value="prop_firm">🟠 Prop Firm</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Journal Mode</label>
                <select
                  value={effectiveMode}
                  onChange={(e) => setJournalMode(e.target.value as JournalMode)}
                  disabled={locked}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  <option value="manual">✍️ Manual</option>
                  <option value="automated">🤖 Automated</option>
                </select>
                {accountType === "prop_firm" && (
                  <p className="mt-2 text-xs text-amber-400">
                    Prop firm accounts are always Manual. Copy execution is disabled.
                  </p>
                )}
                {accountType === "demo" && (
                  <p className="mt-2 text-xs text-white/60">
                    Demo accounts are locked to Manual mode.
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-rose-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-white/20 px-4 py-2 text-sm text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
