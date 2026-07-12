"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { BrokerAccount } from "@/lib/types";
import { updateBrokerAccountAction } from "./actions";

type AccountType = "live" | "demo" | "prop_firm";
type JournalMode = "manual" | "automated";

export default function EditAccountModal({ account }: { account: BrokerAccount }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(account.label);
  const [accountType, setAccountType] = useState<AccountType>(account.account_type);
  const [journalMode, setJournalMode] = useState<JournalMode>(account.journal_mode);
  const [accountNumber, setAccountNumber] = useState(account.account_number ?? "");
  const [readonlyPassword, setReadonlyPassword] = useState(account.readonly_password ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const propFirmLocked = accountType === "prop_firm";
  const effectiveMode: JournalMode = propFirmLocked ? "manual" : journalMode;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("journal_mode", effectiveMode);

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("updateBrokerAccount submit:", Object.fromEntries(fd.entries()));
    }

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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-white/10 bg-panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Edit Broker Account</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-white/60 hover:text-white"
              >
                <X size={18} aria-hidden />
              </button>
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
                  className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Account Type</label>
                <select
                  name="account_type"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as AccountType)}
                  className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm text-white"
                >
                  <option value="live">Live</option>
                  <option value="demo">Demo</option>
                  <option value="prop_firm">Prop firm</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Journal Mode</label>
                {propFirmLocked ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    Manual only — prop firm accounts run in journal-only mode. The EA reads your trades; it never executes.
                  </div>
                ) : (
                  <select
                    value={journalMode}
                    onChange={(e) => setJournalMode(e.target.value as JournalMode)}
                    className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm text-white"
                  >
                    <option value="manual">Manual</option>
                    <option value="automated">Automated</option>
                  </select>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Account Number (optional)</label>
                <input
                  name="account_number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. 12345678"
                  className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Read-Only Password (optional)</label>
                <input
                  name="readonly_password"
                  type="text"
                  value={readonlyPassword}
                  onChange={(e) => setReadonlyPassword(e.target.value)}
                  maxLength={200}
                  placeholder="Investor/read-only password only — never your master password"
                  className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 text-sm text-white"
                />
                <p className="mt-1 text-[11px] text-amber-400">
                  Never enter your master trading password. Read-only password only.
                </p>
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
